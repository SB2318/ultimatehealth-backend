const express = require("express");
const authToken = require("../middleware/authentcatetoken");
const { logMetrics, getWeeklyMetrics } = require("../controllers/wellnessController");

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     WellnessLog:
 *       type: object
 *       properties:
 *         userId:
 *           type: string
 *         date:
 *           type: string
 *           description: Date in YYYY-MM-DD format
 *         metrics:
 *           type: object
 *           properties:
 *             steps:
 *               type: number
 *             activeMinutes:
 *               type: number
 *             sleepHours:
 *               type: number
 *             waterMl:
 *               type: number
 *             caloriesBurned:
 *               type: number
 *             breathingSessionMinutes:
 *               type: number
 *         createdAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /wellness/log:
 *   post:
 *     summary: Log or update daily wellness metrics
 *     tags: [Wellness]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - date
 *             properties:
 *               date:
 *                 type: string
 *                 example: "2026-07-08"
 *               metrics:
 *                 type: object
 *                 properties:
 *                   steps:
 *                     type: number
 *                     example: 5000
 *                   waterMl:
 *                     type: number
 *                     example: 1500
 *                   sleepHours:
 *                     type: number
 *                     example: 7.5
 *                   breathingSessionMinutes:
 *                     type: number
 *                     example: 5
 *     responses:
 *       200:
 *         description: Successfully logged metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/WellnessLog'
 */
router.post("/log", authToken, logMetrics);

/**
 * @swagger
 * /wellness/weekly:
 *   get:
 *     summary: Get wellness metrics for the past 7 days
 *     tags: [Wellness]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved weekly metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/WellnessLog'
 */
router.get("/weekly", authToken, getWeeklyMetrics);

module.exports = router;
