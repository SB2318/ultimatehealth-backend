const { GoogleGenerativeAI } = require("@google/generative-ai");
const { geminiBreaker } = require("../utils/circuitBreaker");

/**
 * Atomic round-robin index counters for each tier
 */
let paidRoundRobinIndex = 0;
let freeRoundRobinIndex = 0;

/**
 * Resolves configured Gemini API keys into two distinct priority tiers:
 * - Tier 1 (Paid Pool): 3 keys from the paid account (High RPM, 1000+ quota, primary)
 * - Tier 2 (Free Pool): 5 keys from free backup accounts (15 RPM fallback)
 * 
 * Supports environment variables:
 * - GEMINI_PAID_KEYS (comma-separated, e.g. key1,key2,key3)
 * - GEMINI_PAID_KEY_1, GEMINI_PAID_KEY_2, GEMINI_PAID_KEY_3
 * - GEMINI_FREE_KEYS (comma-separated, e.g. free1,free2,free3,free4,free5)
 * - GEMINI_FREE_KEY_1 through GEMINI_FREE_KEY_5
 * - Legacy fallback: GEMINI_API_KEY, GEMINI_API_KEYS, GEMINI_API_KEY_1..5
 * 
 * @returns {{ paidKeys: string[], freeKeys: string[], totalKeys: number }}
 */
function getTieredKeyPool() {
    const rawPaid = [];
    const rawFree = [];

    // 1. Tier 1: Paid Keys (e.g. 3 keys on Paid Pay-As-You-Go account)
    if (process.env.GEMINI_PAID_KEYS) {
        process.env.GEMINI_PAID_KEYS.split(',').forEach(k => rawPaid.push(k.trim()));
    }
    rawPaid.push(
        process.env.GEMINI_PAID_KEY_1,
        process.env.GEMINI_PAID_KEY_2,
        process.env.GEMINI_PAID_KEY_3
    );

    // 2. Tier 2: Free Backup Keys (e.g. 5 keys on free accounts)
    if (process.env.GEMINI_FREE_KEYS) {
        process.env.GEMINI_FREE_KEYS.split(',').forEach(k => rawFree.push(k.trim()));
    }
    rawFree.push(
        process.env.GEMINI_FREE_KEY_1,
        process.env.GEMINI_FREE_KEY_2,
        process.env.GEMINI_FREE_KEY_3,
        process.env.GEMINI_FREE_KEY_4,
        process.env.GEMINI_FREE_KEY_5
    );

    // 3. Backward Compatibility Fallback:
    // If no explicit GEMINI_PAID_* keys are configured, check legacy GEMINI_API_KEY(s)
    if (rawPaid.filter(Boolean).length === 0) {
        if (process.env.GEMINI_API_KEYS) {
            process.env.GEMINI_API_KEYS.split(',').forEach(k => rawPaid.push(k.trim()));
        }
        rawPaid.push(
            process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY,
            process.env.GEMINI_API_KEY_2,
            process.env.GEMINI_API_KEY_3
        );
        // Also legacy 4 and 5 if provided
        if (rawFree.filter(Boolean).length === 0) {
            rawFree.push(
                process.env.GEMINI_API_KEY_4,
                process.env.GEMINI_API_KEY_5
            );
        }
    }

    // Sanitize and deduplicate
    const cleanPaid = [...new Set(rawPaid.filter(k => Boolean(k) && typeof k === 'string' && k.trim().length > 0))];
    const cleanFree = [...new Set(rawFree.filter(k => Boolean(k) && typeof k === 'string' && k.trim().length > 0))].filter(k => !cleanPaid.includes(k));

    return {
        paidKeys: cleanPaid,
        freeKeys: cleanFree,
        totalKeys: cleanPaid.length + cleanFree.length
    };
}

/**
 * Sleep helper for transient backoff delays
 */
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Attempts calling Gemini with a single key
 */
async function invokeGeminiWithKey({ apiKey, model, systemInstruction, history, message, generationConfig }) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelParams = {
        model,
        systemInstruction,
    };
    if (generationConfig) {
        modelParams.generationConfig = generationConfig;
    }
    const generativeModel = genAI.getGenerativeModel(modelParams);

    const chat = generativeModel.startChat({ history });
    const result = await chat.sendMessage(message);
    return result.response.text();
}

/**
 * Sends a single message to Gemini utilizing Tiered Key Architecture:
 * - Priority Tier 1: 3 Paid Keys distributed concurrently via Round-Robin.
 * - Fallback Tier 2: 5 Free Keys automatically engaged if Tier 1 is exhausted or fails.
 *
 * @param {Object} options
 * @param {string} options.model - Gemini model name (default: gemini-3.5-flash)
 * @param {string} options.systemInstruction - System prompt for the model
 * @param {Array} options.history - Prior chat turns in Gemini's { role, parts } shape
 * @param {string} options.message - The message to send for this turn
 * @returns {Promise<string>} The model's text response
 */
async function generateWithKeyRotation({
    model = process.env.GEMINI_MODEL || "gemini-2.5-flash",
    systemInstruction,
    history = [],
    message,
    generationConfig,
}) {
    return await geminiBreaker.execute(
        async () => {
            const { paidKeys, freeKeys, totalKeys } = getTieredKeyPool();

            if (totalKeys === 0) {
                throw new Error("No Gemini API keys configured. Please configure GEMINI_PAID_KEYS or GEMINI_API_KEY in .env");
            }

            let lastError = null;

            // ==========================================
            // TIER 1: PAID ACCOUNT KEYS (High Concurrency)
            // ==========================================
            if (paidKeys.length > 0) {
                const paidStart = (paidRoundRobinIndex++) % paidKeys.length;

                for (let step = 0; step < paidKeys.length; step++) {
                    const idx = (paidStart + step) % paidKeys.length;
                    const key = paidKeys[idx];

                    try {
                        const reply = await invokeGeminiWithKey({
                            apiKey: key,
                            model,
                            systemInstruction,
                            history,
                            message,
                            generationConfig
                        });
                        return reply;
                    } catch (err) {
                        lastError = err;
                        const errMsg = err.message || '';
                        console.warn(`[Gemini:Tier1-Paid] Key #${idx + 1} failed: ${errMsg}`);

                        const isRateOrTransient = errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('503') || errMsg.includes('UNAVAILABLE');
                        if (isRateOrTransient && paidKeys.length === 1) {
                            // If user only configured 1 paid key, give it a quick 600ms backoff retry before falling over
                            await wait(600 + Math.random() * 400);
                            try {
                                return await invokeGeminiWithKey({
                                    apiKey: key,
                                    model,
                                    systemInstruction,
                                    history,
                                    message,
                                    generationConfig
                                });
                            } catch (retryErr) {
                                lastError = retryErr;
                            }
                        }
                    }
                }
            }

            // ==========================================
            // TIER 2: FREE BACKUP KEYS (Fallback)
            // ==========================================
            if (freeKeys.length > 0) {
                console.warn(`[Gemini:Tier2-Free] Tier 1 (Paid) unavailable. Falling over to Free Tier (${freeKeys.length} backup accounts)...`);

                const freeStart = (freeRoundRobinIndex++) % freeKeys.length;

                for (let step = 0; step < freeKeys.length; step++) {
                    const idx = (freeStart + step) % freeKeys.length;
                    const key = freeKeys[idx];

                    try {
                        const reply = await invokeGeminiWithKey({
                            apiKey: key,
                            model,
                            systemInstruction,
                            history,
                            message,
                            generationConfig
                        });
                        return reply;
                    } catch (err) {
                        lastError = err;
                        console.warn(`[Gemini:Tier2-Free] Backup Key #${idx + 1} failed: ${err.message || ''}`);
                        // Immediately rotate to next free key on 429
                    }
                }
            }

            throw new Error(`All Gemini API keys (Tier 1 Paid + Tier 2 Free) exhausted or rate limited. Last error: ${lastError ? lastError.message : 'Unknown'}`);
        },
        // Fallback function when Circuit is OPEN or all retries fail
        (error) => {
            console.warn("[GeminiBreaker] Returning fallback AI response due to outage:", error.message);
            return "I am currently experiencing higher than usual traffic. Please try again in a few moments or consult our health articles.";
        }
    );
}

module.exports = {
    generateWithKeyRotation,
    getTieredKeyPool
};
