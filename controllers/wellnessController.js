const expressAsyncHandler = require("express-async-handler");
const WellnessLog = require('../models/WellnessLog');

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

module.exports = {
    logMetrics,
    getWeeklyMetrics
};
