const { GoogleGenerativeAI } = require("@google/generative-ai");
const { geminiBreaker } = require("../utils/circuitBreaker");

let paidRoundRobinIndex = 0;
let freeRoundRobinIndex = 0;

function getTieredKeyPool() {
    const rawPaid = [];
    const rawFree = [];

    if (process.env.GEMINI_PAID_KEYS) {
        process.env.GEMINI_PAID_KEYS.split(',').forEach(k => rawPaid.push(k.trim()));
    }
    rawPaid.push(
        process.env.GEMINI_PAID_KEY_1,
        process.env.GEMINI_PAID_KEY_2,
        process.env.GEMINI_PAID_KEY_3
    );

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

    if (rawPaid.filter(Boolean).length === 0) {
        if (process.env.GEMINI_API_KEYS) {
            process.env.GEMINI_API_KEYS.split(',').forEach(k => rawPaid.push(k.trim()));
        }
        rawPaid.push(
            process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY,
            process.env.GEMINI_API_KEY_2,
            process.env.GEMINI_API_KEY_3
        );
        if (rawFree.filter(Boolean).length === 0) {
            rawFree.push(
                process.env.GEMINI_API_KEY_4,
                process.env.GEMINI_API_KEY_5
            );
        }
    }

    const cleanPaid = [...new Set(rawPaid.filter(k => Boolean(k) && typeof k === 'string' && k.trim().length > 0))];
    const cleanFree = [...new Set(rawFree.filter(k => Boolean(k) && typeof k === 'string' && k.trim().length > 0))].filter(k => !cleanPaid.includes(k));

    return {
        paidKeys: cleanPaid,
        freeKeys: cleanFree,
        totalKeys: cleanPaid.length + cleanFree.length
    };
}

const PER_ATTEMPT_TIMEOUT = parseInt(process.env.GEMINI_PER_ATTEMPT_TIMEOUT_MS || "6000", 10);
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function isModelLevelError(errMsg = '') {
    const lower = errMsg.toLowerCase();
    return lower.includes('503') ||
           lower.includes('high demand') ||
           lower.includes('unavailable') ||
           lower.includes('timed out') ||
           lower.includes('timeout') ||
           lower.includes('fetch failed') ||
           lower.includes('404') ||
           lower.includes('not found') ||
           lower.includes('no longer available') ||
           lower.includes('model is overloaded');
}

function getCandidateModels(primaryModel) {
    const rawList = [
        primaryModel,
        process.env.GEMINI_MODEL,
        ...(process.env.GEMINI_FALLBACK_MODELS ? process.env.GEMINI_FALLBACK_MODELS.split(',').map(s => s.trim()) : []),
        "gemini-2.5-flash",
        "gemini-3.5-flash-lite",
        "gemini-3.1-flash-lite"
    ];
    return [...new Set(rawList.filter(m => Boolean(m) && typeof m === 'string' && m.trim().length > 0))];
}

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

    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`Model ${model} timed out after ${PER_ATTEMPT_TIMEOUT}ms (503 / High Demand hang)`));
        }, PER_ATTEMPT_TIMEOUT);
    });

    try {
        const result = await Promise.race([chat.sendMessage(message), timeoutPromise]);
        return result.response.text();
    } finally {
        clearTimeout(timeoutId);
    }
}

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

            const candidateModels = getCandidateModels(model);
            let lastError = null;

            for (let mIdx = 0; mIdx < candidateModels.length; mIdx++) {
                const currentModel = candidateModels[mIdx];
                let modelLevelFailure = false;

                if (paidKeys.length > 0) {
                    const paidStart = (paidRoundRobinIndex++) % paidKeys.length;

                    for (let step = 0; step < paidKeys.length; step++) {
                        const idx = (paidStart + step) % paidKeys.length;
                        const key = paidKeys[idx];

                        try {
                            const reply = await invokeGeminiWithKey({
                                apiKey: key,
                                model: currentModel,
                                systemInstruction,
                                history,
                                message,
                                generationConfig
                            });
                            return reply;
                        } catch (err) {
                            lastError = err;
                            const errMsg = err.message || '';
                            console.warn(`[Gemini:Tier1-Paid] Key #${idx + 1} (${currentModel}) failed: ${errMsg}`);

                            if (isModelLevelError(errMsg)) {
                                modelLevelFailure = true;
                                console.warn(`[Gemini:ModelFailover] Model '${currentModel}' hit capacity/availability issue (${errMsg.split('\n')[0]}). Switching to next candidate model...`);
                                break;
                            }

                            const isRateOrTransient = errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED');
                            if (isRateOrTransient && paidKeys.length === 1) {
                                await wait(600 + Math.random() * 400);
                                try {
                                    return await invokeGeminiWithKey({
                                        apiKey: key,
                                        model: currentModel,
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

                if (modelLevelFailure) {
                    continue;
                }

                if (freeKeys.length > 0) {
                    console.warn(`[Gemini:Tier2-Free] Tier 1 (Paid) unavailable for '${currentModel}'. Falling over to Free Tier (${freeKeys.length} backup accounts)...`);

                    const freeStart = (freeRoundRobinIndex++) % freeKeys.length;

                    for (let step = 0; step < freeKeys.length; step++) {
                        const idx = (freeStart + step) % freeKeys.length;
                        const key = freeKeys[idx];

                        try {
                            const reply = await invokeGeminiWithKey({
                                apiKey: key,
                                model: currentModel,
                                systemInstruction,
                                history,
                                message,
                                generationConfig
                            });
                            return reply;
                        } catch (err) {
                            lastError = err;
                            const errMsg = err.message || '';
                            console.warn(`[Gemini:Tier2-Free] Backup Key #${idx + 1} (${currentModel}) failed: ${errMsg}`);

                            if (isModelLevelError(errMsg)) {
                                modelLevelFailure = true;
                                console.warn(`[Gemini:ModelFailover] Model '${currentModel}' hit capacity/availability issue in Free tier. Switching to next candidate model...`);
                                break;
                            }
                        }
                    }
                }

                if (modelLevelFailure) {
                    continue;
                }
            }

            throw new Error(`All candidate models (${candidateModels.join(', ')}) and keys exhausted. Last error: ${lastError ? lastError.message : 'Unknown'}`);
        },
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
