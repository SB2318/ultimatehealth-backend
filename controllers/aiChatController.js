const expressAsyncHandler = require("express-async-handler");
const dotenv = require('dotenv');

const User = require('../models/UserModel');
const Conversation = require('../models/ai/Conversation');
const Message = require('../models/ai/Message');
const { generateWithKeyRotation } = require('../services/geminiService');
const { getClientIp, recordAuditLog } = require('../middleware/hipaaAudit');
const { sanitizePhi, sanitizeForAI } = require('../utils/phiSanitizer');
const { evaluateGuardrails, HARDENED_CHARACTER_PROMPTS } = require('../utils/aiGuardrails');

dotenv.config();

const PPLX_URL = "https://api.perplexity.ai/chat/completions";
const MODEL = "sonar-pro";

const MAX_DAY_LIMIT = parseInt(process.env.AI_MAX_DAILY_MESSAGES || "5", 10);

// HIPAA Compliance Statements & Clinical Safety Disclaimers (45 CFR § 164.530 & Clinical Decision Support)
const HIPAA_CLINICAL_DISCLAIMER = "UltimateHealth AI provides educational health and wellness guidance only. It does not provide medical diagnosis, treatment, or clinical prescriptions. Always consult a licensed healthcare professional for clinical decisions. In an emergency, dial 911 or visit the nearest emergency department immediately.";
const HIPAA_COMPLIANCE_NOTICE = "HIPAA Privacy Rule Protected Health Information (45 CFR Parts 160 & 164). Access and interactions are audit-logged.";

const HIPAA_SYSTEM_DIRECTIVE = `
[HIPAA COMPLIANCE & CLINICAL SAFETY MANDATE]
1. You are an educational health and wellness assistant for UltimateHealth, not a personal physician.
2. NEVER provide a definitive medical diagnosis, prescribe drugs, or alter medication dosages.
3. NEVER solicit or store Social Security Numbers, government IDs, or payment credentials.
4. If a user describes an acute medical emergency (e.g., severe chest pain, sudden numbness/paralysis, difficulty breathing, profuse bleeding, or suicidal ideation), IMMEDIATELY advise them to contact emergency services (e.g., 911, or 988 Suicide & Crisis Lifeline) or go to the nearest emergency room.
5. Emphasize evidence-based lifestyle, nutrition, hydration, and exercise habits while recommending discussion with their primary care physician.
`;

// Character configurations with embedded HIPAA clinical guardrails & strict domain bounds
const characterPrompts = {
    general: `${HARDENED_CHARACTER_PROMPTS.general}\n${HIPAA_SYSTEM_DIRECTIVE}`,
    fitness_coach: `${HARDENED_CHARACTER_PROMPTS.fitness_coach}\n${HIPAA_SYSTEM_DIRECTIVE}`,
    nutritionist: `${HARDENED_CHARACTER_PROMPTS.nutritionist}\n${HIPAA_SYSTEM_DIRECTIVE}`,
    mental_wellness: `${HARDENED_CHARACTER_PROMPTS.mental_wellness}\n${HIPAA_SYSTEM_DIRECTIVE}`
};

const startConversation = expressAsyncHandler(
    async (req, res) => {
        const userId = req.userId;
        const { text, character = 'general' } = req.body;
        const ipAddress = getClientIp(req);
        const userAgent = req.headers['user-agent'] || 'unknown';

        if (!text || typeof text !== 'string' || !text.trim()) {
            return res.status(400).json({ success: false, message: "Text is required" });
        }

        try {
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ success: false, message: "User not found" });
            }

            // Find or create conversation for the specific character
            let conv = await Conversation.findOne({ userId, characterName: character });
            if (!conv) {
                conv = await Conversation.create({ userId, characterName: character });
            }
            const conversationId = conv._id;

            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date();
            endOfDay.setHours(23, 59, 59, 999);

            const messages = await Message.find({
                conversationId: conversationId,
                role: 'model',
                $or: [
                    { timestamp: { $gte: startOfDay.getTime(), $lte: endOfDay.getTime() } },
                    { createdAt: { $gte: startOfDay, $lte: endOfDay } }
                ]
            });

            if (messages.length >= MAX_DAY_LIMIT) {
                return res.status(429).json({
                    success: false,
                    error: "Daily quota exceeded for this character",
                    remaining: 0
                });
            }

            // Save user message to database
            const userMsg = await Message.create({
                role: "user",
                text: text.trim(),
                conversationId
            });

            // Evaluate AI Guardrails & Character Boundaries
            const guardResult = evaluateGuardrails(text, character);
            if (!guardResult.passed) {
                // Save guardrail refusal / emergency response
                const guardMsg = await Message.create({
                    role: "model",
                    text: guardResult.fallbackReply,
                    conversationId
                });

                await recordAuditLog({
                    actorId: userId,
                    actorRole: user.isDoctor ? 'doctor' : 'patient',
                    patientId: userId,
                    action: 'CHAT_QUERY_GUARDRAIL_BLOCKED',
                    resourceType: 'Conversation',
                    resourceId: conversationId,
                    ipAddress,
                    userAgent,
                    severity: guardResult.isEmergency ? 'critical' : 'warning',
                    status: 'blocked',
                    details: {
                        character,
                        category: guardResult.category,
                        reason: guardResult.reason,
                        isEmergency: Boolean(guardResult.isEmergency)
                    }
                });

                return res.status(200).json({
                    success: true,
                    guardrailBlocked: true,
                    category: guardResult.category,
                    complianceNotice: HIPAA_COMPLIANCE_NOTICE,
                    disclaimer: HIPAA_CLINICAL_DISCLAIMER,
                    phiSanitized: false,
                    message: guardMsg
                });
            }

            const history = await Message.find({ conversationId }).sort({ _id: 1 });

            // HIPAA Safe Harbor de-identification: sanitize prompt history before transmission to external AI API
            const { hasRedactedPhi } = sanitizePhi(text);
            const reply = await generateReplyWithRotation(history, character);

            // Save assistant reply
            const newMsg = await Message.create({
                role: "model",
                text: reply,
                conversationId
            });

            // HIPAA Audit Log (45 CFR § 164.312(b))
            await recordAuditLog({
                actorId: userId,
                actorRole: user.isDoctor ? 'doctor' : 'patient',
                patientId: userId,
                action: 'CHAT_QUERY',
                resourceType: 'Conversation',
                resourceId: conversationId,
                ipAddress,
                userAgent,
                severity: 'info',
                status: 'success',
                details: {
                    character,
                    userMessageId: userMsg._id,
                    modelMessageId: newMsg._id,
                    phiSanitized: hasRedactedPhi,
                    provider: 'gemini'
                }
            });

            return res.status(200).json({
                success: true,
                complianceNotice: HIPAA_COMPLIANCE_NOTICE,
                disclaimer: HIPAA_CLINICAL_DISCLAIMER,
                phiSanitized: hasRedactedPhi,
                message: newMsg
            });

        } catch (err) {
            console.error("startConversation error:", err);

            await recordAuditLog({
                actorId: userId,
                actorRole: 'patient',
                patientId: userId,
                action: 'CHAT_QUERY',
                resourceType: 'Conversation',
                ipAddress,
                userAgent,
                severity: 'warning',
                status: 'failure',
                details: { character, error: err.message }
            });

            res.status(500).json({ success: false, error: err.message });
        }
    }
);

async function generateReplyWithRotation(history, character) {
    // Sanitize historical message parts to ensure no ePHI leakage to Google Gemini
    const formattedMessages = history.map(m => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: sanitizeForAI(m.text) }]
    }));

    const systemInstruction = characterPrompts[character] || characterPrompts['general'];

    return generateWithKeyRotation({
        systemInstruction,
        history: formattedMessages,
        message: "Continue the conversation",
    });
}

const startPPLXConversation = expressAsyncHandler(async (req, res) => {
    const userId = req.userId;
    const { text, character = 'general' } = req.body;
    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'unknown';

    if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ success: false, message: "Text is required" });
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        let conv = await Conversation.findOne({ userId, characterName: character });
        if (!conv) {
            conv = await Conversation.create({ userId, characterName: character });
        }
        const conversationId = conv._id;

        // Daily limit check
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const modelMessagesToday = await Message.find({
            conversationId,
            role: "model",
            $or: [
                { timestamp: { $gte: startOfDay.getTime(), $lte: endOfDay.getTime() } },
                { createdAt: { $gte: startOfDay, $lte: endOfDay } }
            ]
        });

        if (modelMessagesToday.length >= MAX_DAY_LIMIT) {
            return res.status(429).json({
                success: false,
                error: "Daily quota exceeded for this character",
                remaining: 0
            });
        }

        const userMsg = await Message.create({
            role: "user",
            text: text.trim(),
            conversationId
        });

        // Evaluate AI Guardrails & Character Boundaries
        const guardResult = evaluateGuardrails(text, character);
        if (!guardResult.passed) {
            const guardMsg = await Message.create({
                role: "model",
                text: guardResult.fallbackReply,
                conversationId
            });

            await recordAuditLog({
                actorId: userId,
                actorRole: user.isDoctor ? 'doctor' : 'patient',
                patientId: userId,
                action: 'CHAT_QUERY_GUARDRAIL_BLOCKED',
                resourceType: 'Conversation',
                resourceId: conversationId,
                ipAddress,
                userAgent,
                severity: guardResult.isEmergency ? 'critical' : 'warning',
                status: 'blocked',
                details: {
                    character,
                    category: guardResult.category,
                    reason: guardResult.reason,
                    isEmergency: Boolean(guardResult.isEmergency),
                    provider: 'perplexity'
                }
            });

            return res.status(200).json({
                success: true,
                guardrailBlocked: true,
                category: guardResult.category,
                complianceNotice: HIPAA_COMPLIANCE_NOTICE,
                disclaimer: HIPAA_CLINICAL_DISCLAIMER,
                phiSanitized: false,
                message: guardMsg
            });
        }

        const history = await Message.find({ conversationId }).sort({ _id: 1 });
        const { hasRedactedPhi } = sanitizePhi(text);

        const reply = await generatePPLXReply(history, character);

        const newMsg = await Message.create({
            role: "model",
            text: reply,
            conversationId
        });

        // HIPAA Audit Log
        await recordAuditLog({
            actorId: userId,
            actorRole: user.isDoctor ? 'doctor' : 'patient',
            patientId: userId,
            action: 'CHAT_QUERY',
            resourceType: 'Conversation',
            resourceId: conversationId,
            ipAddress,
            userAgent,
            severity: 'info',
            status: 'success',
            details: {
                character,
                userMessageId: userMsg._id,
                modelMessageId: newMsg._id,
                phiSanitized: hasRedactedPhi,
                provider: 'perplexity'
            }
        });

        return res.status(200).json({
            success: true,
            complianceNotice: HIPAA_COMPLIANCE_NOTICE,
            disclaimer: HIPAA_CLINICAL_DISCLAIMER,
            phiSanitized: hasRedactedPhi,
            message: newMsg
        });

    } catch (err) {
        console.error("startPPLXConversation error:", err);

        await recordAuditLog({
            actorId: userId,
            actorRole: 'patient',
            patientId: userId,
            action: 'CHAT_QUERY',
            resourceType: 'Conversation',
            ipAddress,
            userAgent,
            severity: 'warning',
            status: 'failure',
            details: { character, error: err.message }
        });

        res.status(500).json({ success: false, error: err.message });
    }
});

async function generatePPLXReply(history, character) {
    // Sanitize historical message content before transmitting to Perplexity
    let messages = history.map(m => ({
        role: m.role === "model" ? "assistant" : "user",
        content: sanitizeForAI(m.text)
    }));

    const cleaned = [];
    for (let i = 0; i < messages.length; i++) {
        if (i === 0 || messages[i].role !== messages[i - 1].role) {
            cleaned.push(messages[i]);
        }
    }

    if (cleaned[cleaned.length - 1].role !== "user") {
        cleaned.push({
            role: "user",
            content: "Continue our conversation."
        });
    }

    const systemInstruction = characterPrompts[character] || characterPrompts['general'];
    cleaned.unshift({
        role: "system",
        content: systemInstruction
    });

    const response = await fetch(PPLX_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${process.env.PPLX_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: MODEL,
            messages: cleaned
        })
    });

    const data = await response.json();
    return data?.choices?.[0]?.message?.content || "Unable to generate response.";
}

const loadConversations = expressAsyncHandler(
    async (req, res) => {
        try {
            const userId = req.userId;
            const character = req.query.character || 'general';
            const ipAddress = getClientIp(req);
            const userAgent = req.headers['user-agent'] || 'unknown';

            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ success: false, message: "User not found" });
            }

            const conv = await Conversation.findOne({ userId, characterName: character });
            if (!conv) {
                await recordAuditLog({
                    actorId: userId,
                    actorRole: user.isDoctor ? 'doctor' : 'patient',
                    patientId: userId,
                    action: 'VIEW_CHAT_HISTORY',
                    resourceType: 'Conversation',
                    ipAddress,
                    userAgent,
                    severity: 'info',
                    status: 'success',
                    details: { character, messageCount: 0 }
                });

                return res.status(200).json({
                    success: true,
                    complianceNotice: HIPAA_COMPLIANCE_NOTICE,
                    disclaimer: HIPAA_CLINICAL_DISCLAIMER,
                    messages: []
                });
            }

            const messages = await Message.find({
                conversationId: conv._id
            });

            const enhancedMessages = messages.map(msg => {
                const m = msg.toObject();
                if (m.role === "user") {
                    m.userHandle = user.user_handle;
                    m.profileImage = user.Profile_image;
                }
                return m;
            });

            // HIPAA Audit Log for viewing conversation transcripts
            await recordAuditLog({
                actorId: userId,
                actorRole: user.isDoctor ? 'doctor' : 'patient',
                patientId: userId,
                action: 'VIEW_CHAT_HISTORY',
                resourceType: 'Conversation',
                resourceId: conv._id,
                ipAddress,
                userAgent,
                severity: 'info',
                status: 'success',
                details: {
                    character,
                    messageCount: enhancedMessages.length
                }
            });

            res.json({
                success: true,
                complianceNotice: HIPAA_COMPLIANCE_NOTICE,
                disclaimer: HIPAA_CLINICAL_DISCLAIMER,
                messages: enhancedMessages
            });

        } catch (err) {
            console.error("loadConversations error:", err);
            res.status(500).json({ success: false, error: err.message });
        }
    }
);

/**
 * Clear conversation history for a specific character (HIPAA Right to Request Deletion/Amendment - 45 CFR § 164.526)
 */
const clearConversation = expressAsyncHandler(async (req, res) => {
    const userId = req.userId;
    const character = req.query.character || req.body.character || 'general';
    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'unknown';

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const conv = await Conversation.findOne({ userId, characterName: character });
        if (!conv) {
            return res.status(200).json({
                success: true,
                complianceNotice: HIPAA_COMPLIANCE_NOTICE,
                message: "No conversation history found to clear."
            });
        }

        const deleteResult = await Message.deleteMany({ conversationId: conv._id });

        // HIPAA Audit Log for record deletion
        await recordAuditLog({
            actorId: userId,
            actorRole: user.isDoctor ? 'doctor' : 'patient',
            patientId: userId,
            action: 'DELETE_CHAT_HISTORY',
            resourceType: 'Conversation',
            resourceId: conv._id,
            ipAddress,
            userAgent,
            severity: 'warning',
            status: 'success',
            details: {
                character,
                deletedMessagesCount: deleteResult.deletedCount
            }
        });

        return res.status(200).json({
            success: true,
            complianceNotice: "HIPAA Right to Request Deletion/Amendment (45 CFR § 164.526)",
            message: `Cleared ${deleteResult.deletedCount} messages for character '${character}'.`
        });

    } catch (err) {
        console.error("clearConversation error:", err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * Export full chat history under HIPAA Right of Access (45 CFR § 164.524)
 */
const exportChatHistory = expressAsyncHandler(async (req, res) => {
    const userId = req.userId;
    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'unknown';

    try {
        const user = await User.findById(userId).select('user_name user_handle email created_at isDoctor');
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const conversations = await Conversation.find({ userId }).lean();
        const exportRecords = [];

        for (const conv of conversations) {
            const messages = await Message.find({ conversationId: conv._id }).sort({ timestamp: 1 }).lean();
            exportRecords.push({
                character: conv.characterName,
                createdAt: conv.createdAt,
                messages: messages.map(m => ({
                    role: m.role,
                    text: m.text,
                    timestamp: m.timestamp
                }))
            });
        }

        // HIPAA Audit Log for full data disclosure
        await recordAuditLog({
            actorId: userId,
            actorRole: user.isDoctor ? 'doctor' : 'patient',
            patientId: userId,
            action: 'EXPORT_CHAT_HISTORY',
            resourceType: 'Conversation',
            resourceId: userId,
            ipAddress,
            userAgent,
            severity: 'info',
            status: 'success',
            details: {
                conversationCount: exportRecords.length,
                totalMessages: exportRecords.reduce((acc, c) => acc + c.messages.length, 0)
            }
        });

        return res.status(200).json({
            success: true,
            complianceNotice: "HIPAA Right of Access Export (45 CFR § 164.524)",
            disclaimer: HIPAA_CLINICAL_DISCLAIMER,
            generatedAt: new Date().toISOString(),
            patient: {
                _id: user._id,
                user_name: user.user_name,
                user_handle: user.user_handle,
                email: user.email,
                role: user.isDoctor ? 'doctor' : 'patient'
            },
            chatHistory: exportRecords
        });

    } catch (err) {
        console.error("exportChatHistory error:", err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

const getCharacters = expressAsyncHandler(async (req, res) => {
    const characters = [
        {
            id: 'general',
            name: 'UltimateHealth Assistant',
            tagline: 'Your personal health suggestion guide',
            avatarUrl: 'https://ui-avatars.com/api/?name=Health+Assistant&background=0D8ABC&color=fff',
            hipaaCompliant: true,
            clinicalRole: 'Educational Health Coach'
        },
        {
            id: 'fitness_coach',
            name: 'Coach Alex',
            tagline: 'Expert in physical fitness, strength, and endurance',
            avatarUrl: 'https://ui-avatars.com/api/?name=Coach+Alex&background=FF5722&color=fff',
            hipaaCompliant: true,
            clinicalRole: 'Physical Fitness & Movement Coach'
        },
        {
            id: 'nutritionist',
            name: 'Dr. Sarah',
            tagline: 'Professional Nutritionist for dietary advice',
            avatarUrl: 'https://ui-avatars.com/api/?name=Dr+Sarah&background=4CAF50&color=fff',
            hipaaCompliant: true,
            clinicalRole: 'Dietary & Nutrition Guide'
        },
        {
            id: 'mental_wellness',
            name: 'Guide Maya',
            tagline: 'Mental Wellness Guide for stress and mindfulness',
            avatarUrl: 'https://ui-avatars.com/api/?name=Guide+Maya&background=9C27B0&color=fff',
            hipaaCompliant: true,
            clinicalRole: 'Mindfulness & Stress Wellness Guide'
        }
    ];

    res.json({
        success: true,
        complianceNotice: HIPAA_COMPLIANCE_NOTICE,
        disclaimer: HIPAA_CLINICAL_DISCLAIMER,
        characters
    });
});

module.exports = {
    startConversation,
    loadConversations,
    clearConversation,
    exportChatHistory,
    startPPLXConversation,
    getCharacters,
};
