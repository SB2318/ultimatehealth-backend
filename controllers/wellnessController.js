const expressAsyncHandler = require("express-async-handler");
const WellnessLog = require('../models/WellnessLog');
const WellnessPlan = require('../models/WellnessPlan');
const { generateWithKeyRotation } = require('../services/geminiService');

const PLAN_SYSTEM_INSTRUCTION = "You are a wellness planning assistant for UltimateHealth. Based on a user's recent activity metrics, generate a realistic 7 day wellness plan. Respond with strict JSON only, no markdown formatting, no commentary, matching this exact shape: { \"goals\": { \"dailySteps\": number, \"dailyWaterMl\": number, \"dailySleepHours\": number, \"dailyActiveMinutes\": number }, \"dailyTasks\": [string, string, string] }";

/**
 * Builds the prompt sent to Gemini from a user's recent WellnessLog entries.
 * Falls back to a beginner-friendly starter prompt when there is no history yet.
 */
function buildPlanPrompt(logs) {
    if (!logs.length) {
        return "The user has no logged activity yet. Generate a beginner friendly starter plan.";
    }

    const totals = logs.reduce((acc, log) => {
        acc.steps += log.metrics?.steps || 0;
        acc.waterMl += log.metrics?.waterMl || 0;
        acc.sleepHours += log.metrics?.sleepHours || 0;
        acc.activeMinutes += log.metrics?.activeMinutes || 0;
        return acc;
    }, { steps: 0, waterMl: 0, sleepHours: 0, activeMinutes: 0 });

    const days = logs.length;
    const avgSteps = Math.round(totals.steps / days);
    const avgWaterMl = Math.round(totals.waterMl / days);
    const avgSleepHours = Number((totals.sleepHours / days).toFixed(1));
    const avgActiveMinutes = Math.round(totals.activeMinutes / days);

    return `The user averaged ${avgSteps} steps, ${avgWaterMl}ml water, ${avgSleepHours} hours sleep, and ${avgActiveMinutes} active minutes per day over the last ${days} day(s). Generate a realistic, slightly progressive 7 day wellness plan building on these numbers.`;
}

/**
 * Parses the raw Gemini response text into the expected plan shape,
 * stripping markdown code fences if the model wraps its JSON in them.
 */
function parsePlanResponse(rawText) {
    const cleaned = rawText
        .trim()
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```$/, '')
        .trim();

    const parsed = JSON.parse(cleaned);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error("AI response was not a JSON object.");
    }

    return parsed;
}

/**
 * @desc    Create or update today's wellness metrics
 * @route   POST /api/wellness/log
 * @access  Private
 */
const logMetrics = expressAsyncHandler(async (req, res) => {
    try {
        const userId = req.userId;
        const { date, metrics } = req.body;

        if (!date) {
            return res.status(400).json({ success: false, message: "Date is required (YYYY-MM-DD)" });
        }

        // Find existing log for this user on this date
        let log = await WellnessLog.findOne({ userId, date });

        if (log) {
            // Update existing log metrics dynamically
            if (metrics) {
                log.metrics = { ...log.metrics.toObject(), ...metrics };
                await log.save();
            }
        } else {
            // Create a new log
            log = await WellnessLog.create({
                userId,
                date,
                metrics: metrics || {}
            });
        }

        return res.status(200).json({
            success: true,
            message: "Wellness metrics logged successfully",
            data: log
        });

    } catch (err) {
        console.error("Error logging wellness metrics:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});

/**
 * @desc    Get the last 7 days of wellness metrics
 * @route   GET /api/wellness/weekly
 * @access  Private
 */
const getWeeklyMetrics = expressAsyncHandler(async (req, res) => {
    try {
        const userId = req.userId;

        // Fetch logs for the past 7 days, sorted by date descending
        const logs = await WellnessLog.find({ userId })
            .sort({ date: -1 })
            .limit(7);

        return res.status(200).json({
            success: true,
            data: logs
        });

    } catch (err) {
        console.error("Error fetching weekly metrics:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});

/**
 * @desc    Generate a new AI wellness plan from the user's last 7 days of logs
 * @route   POST /api/wellness/plan/generate
 * @access  Private
 */
const generateAIPlan = expressAsyncHandler(async (req, res) => {
    try {
        const userId = req.userId;

        const logs = await WellnessLog.find({ userId })
            .sort({ date: -1 })
            .limit(7);

        const prompt = buildPlanPrompt(logs);

        let parsedPlan;
        try {
            const rawText = await generateWithKeyRotation({
                systemInstruction: PLAN_SYSTEM_INSTRUCTION,
                message: prompt
            });
            parsedPlan = parsePlanResponse(rawText);
        } catch (aiErr) {
            console.error("Error generating or parsing AI wellness plan:", aiErr);
            return res.status(502).json({
                success: false,
                message: "Failed to generate a wellness plan. Please try again."
            });
        }

        // Only one plan should be active per user at a time
        await WellnessPlan.updateMany(
            { userId, isActive: true },
            { isActive: false }
        );

        const plan = await WellnessPlan.create({
            userId,
            isActive: true,
            goals: parsedPlan.goals || {},
            dailyTasks: Array.isArray(parsedPlan.dailyTasks) ? parsedPlan.dailyTasks : [],
            basedOnLogs: logs.map((log) => log._id)
        });

        return res.status(201).json({
            success: true,
            message: "Wellness plan generated successfully",
            data: plan
        });

    } catch (err) {
        console.error("Error generating wellness plan:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});

/**
 * @desc    Get the user's currently active wellness plan
 * @route   GET /api/wellness/plan
 * @access  Private
 */
const getLatestPlan = expressAsyncHandler(async (req, res) => {
    try {
        const userId = req.userId;

        const plan = await WellnessPlan.findOne({ userId, isActive: true })
            .sort({ createdAt: -1 });

        if (!plan) {
            return res.status(404).json({
                success: false,
                message: "No active wellness plan found"
            });
        }

        return res.status(200).json({
            success: true,
            data: plan
        });

    } catch (err) {
        console.error("Error fetching latest wellness plan:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});

module.exports = {
    logMetrics,
    getWeeklyMetrics,
    generateAIPlan,
    getLatestPlan
};
