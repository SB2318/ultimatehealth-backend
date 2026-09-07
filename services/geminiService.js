const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * Sends a single message to Gemini, rotating across all configured API keys
 * until one succeeds. Shared by aiChatController and wellnessController so
 * the fallback behavior stays consistent across features.
 *
 * @param {Object} options
 * @param {string} options.model - Gemini model name
 * @param {string} options.systemInstruction - System prompt for the model
 * @param {Array} options.history - Prior chat turns in Gemini's { role, parts } shape
 * @param {string} options.message - The message to send for this turn
 * @returns {Promise<string>} The model's text response
 */
const { geminiBreaker } = require("../utils/circuitBreaker");

async function generateWithKeyRotation({
    model = "gemini-2.5-flash",
    systemInstruction,
    history = [],
    message,
}) {
    // Wrap the API call with Circuit Breaker protection
    return await geminiBreaker.execute(
        async () => {
            const geminiKeys = [
                process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY,
                process.env.GEMINI_API_KEY_2,
                process.env.GEMINI_API_KEY_3,
                process.env.GEMINI_API_KEY_4,
                process.env.GEMINI_API_KEY_5
            ].filter(Boolean);

            if (geminiKeys.length === 0) {
                throw new Error("No Gemini API keys configured.");
            }

            for (let i = 0; i < geminiKeys.length; i++) {
                try {
                    const genAI = new GoogleGenerativeAI(geminiKeys[i]);
                    const generativeModel = genAI.getGenerativeModel({
                        model,
                        systemInstruction,
                    });

                    const chat = generativeModel.startChat({ history });
                    const result = await chat.sendMessage(message);
                    return result.response.text();
                } catch (err) {
                    console.error(`[Gemini] Key ${i + 1} failed:`, err.message);
                    if (i === geminiKeys.length - 1) {
                        throw new Error("All AI API keys exhausted or rate limited.");
                    }
                }
            }
        },
        // Fallback function when Circuit is OPEN or all retries fail
        (error) => {
            console.warn("[GeminiBreaker] Returning fallback AI response due to outage:", error.message);
            return "I am currently experiencing higher than usual traffic. Please try again in a few moments or consult our health articles.";
        }
    );
}

module.exports = { generateWithKeyRotation };
