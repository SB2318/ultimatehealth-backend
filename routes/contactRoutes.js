const express = require('express');
const { submitContactForm } = require('../controllers/contactController');

const router = express.Router();

/**
 * @openapi
 * /contact:
 *   post:
 *     summary: Submit a user contact or support message
 *     description: >
 *       Public contact form. Messages are saved to the database and forwarded
 *       to the support inbox via authenticated SMTP with direct user replyTo routing.
 *     tags:
 *       - Contact
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - subject
 *               - message
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Jane Doe"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "jane.doe@example.com"
 *               subject:
 *                 type: string
 *                 example: "Question about cardiac article"
 *               message:
 *                 type: string
 *                 example: "Could you provide additional references on diet recommendations?"
 *     responses:
 *       '200':
 *         description: Message received successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Your message has been received. We will contact you shortly."
 *       '400':
 *         description: Missing fields or invalid email address
 *       '500':
 *         description: Internal server error
 */
router.post('/contact', submitContactForm);

module.exports = router;
