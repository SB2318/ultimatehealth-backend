const express = require("express");
const authToken = require("../middleware/authentcatetoken");
const { logMetrics, getWeeklyMetrics, generateAIPlan, getLatestPlan } = require("../controllers/wellnessController");

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
 *     WellnessPlan:
 *       type: object
 *       properties:
 *         userId:
 *           type: string
 *         isActive:
 *           type: boolean
 *         goals:
 *           type: object
 *           properties:
 *             dailySteps:
 *               type: number
 *             dailyWaterMl:
 *               type: number
 *             dailySleepHours:
 *               type: number
 *             dailyActiveMinutes:
 *               type: number
 *         dailyTasks:
 *           type: array
 *           items:
 *             type: string
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

/**
 * @swagger
 * /wellness/plan/generate:
 *   post:
 *     summary: Generate a new AI wellness plan from the user's last 7 days of logs
 *     tags: [Wellness]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Successfully generated a wellness plan
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
 *                   $ref: '#/components/schemas/WellnessPlan'
 *       502:
 *         description: The AI provider failed to generate a valid plan
 */
router.post("/plan/generate", authToken, generateAIPlan);

/**
 * @swagger
 * /wellness/plan:
 *   get:
 *     summary: Get the user's currently active wellness plan
 *     tags: [Wellness]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved the active wellness plan
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/WellnessPlan'
 *       404:
 *         description: No active wellness plan found
 */
router.get("/plan", authToken, getLatestPlan);

module.exports = router;
