const express = require("express");
const authToken = require("../middleware/authentcatetoken");
const { aiChatLimiter } = require("../middleware/ratelimit");
const router = express.Router();

const {
    startConversation,
    loadConversations,
    clearConversation,
    exportChatHistory,
    startPPLXConversation,
    getCharacters
} = require('../controllers/aiChatController');

/**
 * @swagger
 * /gemini/send:
 *   post:
 *     summary: Send a message to Gemini & receive response (HIPAA Compliant & PHI De-identified)
 *     description: Sanitizes direct PHI/PII identifiers before transmission to external AI model, maintains immutable HIPAA audit logs (45 CFR § 164.312(b)), and enforces clinical non-diagnostic guardrails.
 *     tags: [ChatBot]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *                 example: "What are some good exercises to reduce lower back tension?"
 *               character:
 *                 type: string
 *                 description: ID of the AI character (general, fitness_coach, nutritionist, mental_wellness)
 *                 example: "fitness_coach"
 *     responses:
 *       200:
 *         description: Gemini's reply with HIPAA advisory and audit confirmation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 complianceNotice:
 *                   type: string
 *                 disclaimer:
 *                   type: string
 *                 phiSanitized:
 *                   type: boolean
 *                 message:
 *                   $ref: '#/components/schemas/Message'
 *       400:
 *         description: Text is required
 *       429:
 *         description: Daily quota or rate limit exceeded
 */
router.post("/send", authToken, aiChatLimiter, startConversation);

/**
 * @swagger
 * /gemini/messages:
 *   get:
 *     summary: Get all chat messages for the user (Audit Logged)
 *     description: Retrieves patient's conversation transcripts for a specific character, recording a HIPAA access audit event (45 CFR § 164.312(b)).
 *     tags: [ChatBot]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: character
 *         schema:
 *           type: string
 *           default: general
 *         description: ID of the character to load history for
 *     responses:
 *       200:
 *         description: Array of messages with HIPAA compliance notice
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 complianceNotice:
 *                   type: string
 *                 disclaimer:
 *                   type: string
 *                 messages:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Message'
 */
router.get("/messages", authToken, loadConversations);

/**
 * @swagger
 * /gemini/messages:
 *   delete:
 *     summary: Clear conversation history for a character (HIPAA Right to Request Deletion/Amendment - 45 CFR § 164.526)
 *     description: Purges message history for a character while recording a deletion audit event in the immutable HIPAA audit log.
 *     tags: [ChatBot]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: character
 *         schema:
 *           type: string
 *           default: general
 *         description: ID of the character whose conversation history will be cleared
 *     responses:
 *       200:
 *         description: Successfully cleared conversation history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 complianceNotice:
 *                   type: string
 *                 message:
 *                   type: string
 */
router.delete("/messages", authToken, clearConversation);

/**
 * @swagger
 * /gemini/export:
 *   get:
 *     summary: Export full chat history under HIPAA Right of Access (45 CFR § 164.524)
 *     description: Generates a complete machine-readable disclosure of the patient's chatbot transcripts across all AI personas.
 *     tags: [ChatBot]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Machine-readable JSON export of all chatbot interactions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 complianceNotice:
 *                   type: string
 *                 disclaimer:
 *                   type: string
 *                 generatedAt:
 *                   type: string
 *                 patient:
 *                   type: object
 *                 chatHistory:
 *                   type: array
 */
router.get("/export", authToken, exportChatHistory);

/**
 * @swagger
 * /gemini/characters:
 *   get:
 *     summary: Get all available AI characters with HIPAA advisories
 *     tags: [ChatBot]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of characters with clinical safety roles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 complianceNotice:
 *                   type: string
 *                 disclaimer:
 *                   type: string
 *                 characters:
 *                   type: array
 */
router.get("/characters", authToken, getCharacters);

module.exports = router;
