const expressAsyncHandler = require("express-async-handler");
const WellnessLog = require('../models/WellnessLog');
const WellnessPlan = require('../models/WellnessPlan');
const { generateWithKeyRotation } = require('../services/geminiService');

const PLAN_SYSTEM_INSTRUCTION = `You are a certified wellness physician and clinical health coach for UltimateHealth. You hold expertise in preventive medicine, sports medicine, sleep science, and behavioural nutrition. Your task is to analyse a patient's real logged health data and produce a personalised, evidence-based 7-day wellness plan that is medically sound, progressive, and motivating.

CLINICAL REFERENCE BENCHMARKS (use these when evaluating patient data):
- Daily Steps: WHO recommends 8,000–10,000 steps/day. Below 5,000 = sedentary risk (elevated CVD and metabolic syndrome risk).
- Active Minutes: ACSM recommends ≥150 min/week of moderate activity = ~22 min/day minimum. Below 15 min/day = critical inactivity.
- Sleep: CDC and Sleep Foundation recommend 7–9 hours/night for adults. Below 6 hrs = chronic sleep deprivation (immune, cognitive, and metabolic harm). Above 9 hrs may indicate underlying fatigue or depression.
- Water Intake: General clinical guideline is 2,000–3,500 ml/day for adults depending on body weight and activity level. Below 1,500 ml = significant dehydration risk.
- Calories Burned: A healthy active adult should burn ≥300–500 kcal through deliberate activity per day. Zero likely indicates no dedicated exercise.
- Guided Breathing / Mindfulness: Even 5–10 min/day of diaphragmatic breathing significantly reduces cortisol, improves HRV, and lowers resting heart rate. Zero indicates a gap in stress management and autonomic recovery.

PLAN GENERATION CLINICAL RULES:
1. PROGRESSIVE OVERLOAD SAFETY: Never increase any metric goal by more than 15% above the patient's 7-day average. Sudden large jumps cause injury, burnout, and non-adherence.
2. CRITICAL DEFICIT PRIORITISATION: If sleep is below 6 hrs, or steps are below 2,000, treat these as the highest priority deficits and build the plan around recovery first.
3. ZERO-VALUE HANDLING: If a metric is 0, assume the user is not yet tracking or practising it. Set a conservative, achievable starter goal (not the full clinical target) to build the habit gradually.
4. HOLISTIC COVERAGE: The plan must address all five wellness domains — (a) Physical Movement, (b) Sleep & Recovery, (c) Hydration & Nutrition, (d) Mental Wellness & Stress, (e) Mindfulness & Breathing. Do not focus on only one area.
5. DAILY TASKS: Generate exactly 7 daily tasks. Each task must be specific (include duration, quantity, or time of day), actionable (something the user can do today), and clinically grounded. Cover all 5 wellness domains across the 7 tasks.
6. FOCUS AREAS: Identify the 2 wellness domains that need the most urgent clinical improvement based on the patient's data.
7. WEEKLY INSIGHT: Write 1–2 sentences of clinical rationale explaining WHY the plan prioritises what it does, using plain language a patient can understand.
8. WARNINGS: List any clinical red flags present in the data (e.g., chronic sleep deprivation, severe sedentary behaviour, dehydration risk). Use an empty array if no concerns exist.
9. TONE: Encouraging but honest. Never alarm unnecessarily, but do not downplay genuine health risks.

OUTPUT FORMAT — respond with STRICT JSON only. No markdown, no code fences, no commentary. Match this exact schema:
{
  "goals": {
    "dailySteps": number,
    "dailyActiveMinutes": number,
    "dailyCaloriesBurned": number,
    "dailySleepHours": number,
    "dailyBreathingMinutes": number,
    "dailyWaterMl": number
  },
  "dailyTasks": [string, string, string, string, string, string, string],
  "focusAreas": [string, string],
  "weeklyInsight": string,
  "warnings": [string]
}`;


function buildPlanPrompt(logs) {
    if (!logs.length) {
        return `This patient has no prior wellness activity logged. They are an absolute beginner.

Generate a safe, encouraging entry-level 7-day plan using conservative clinical starter goals:
- Daily Steps: 5,000 (below WHO target but achievable for a sedentary beginner)
- Active Minutes: 15 min/day (minimum ACSM entry threshold)
- Calories Burned: 150 kcal from activity (gentle start)
- Sleep: 7.5 hours (middle of CDC recommended range)
- Guided Breathing: 10 min/day (foundational stress management habit)
- Water Intake: 2,000 ml/day (minimum healthy hydration)

Focus the 7 daily tasks on habit formation across all wellness domains. Tasks should be simple, require no equipment, and build confidence. Prioritise sleep consistency and basic hydration since these yield the fastest early health improvements.`;
    }

    // Aggregate all 6 logged metrics across the available log period
    const totals = logs.reduce((acc, log) => {
        acc.steps += log.metrics?.steps || 0;
        acc.waterMl += log.metrics?.waterMl || 0;
        acc.sleepHours += log.metrics?.sleepHours || 0;
        acc.activeMinutes += log.metrics?.activeMinutes || 0;
        acc.caloriesBurned += log.metrics?.caloriesBurned || 0;
        acc.breathingMinutes += log.metrics?.breathingSessionMinutes || 0;
        return acc;
    }, { steps: 0, waterMl: 0, sleepHours: 0, activeMinutes: 0, caloriesBurned: 0, breathingMinutes: 0 });

    const days = logs.length;
    const avg = {
        steps: Math.round(totals.steps / days),
        waterMl: Math.round(totals.waterMl / days),
        sleepHours: Number((totals.sleepHours / days).toFixed(1)),
        activeMinutes: Math.round(totals.activeMinutes / days),
        caloriesBurned: Math.round(totals.caloriesBurned / days),
        breathingMinutes: Math.round(totals.breathingMinutes / days)
    };

    // Annotate each metric with its clinical standing vs. published guidelines
    const stepStatus =
        avg.steps < 2000 ? 'critically sedentary — very high cardiovascular and metabolic disease risk (WHO)' :
        avg.steps < 5000 ? 'sedentary — elevated CVD risk, below half of WHO daily target' :
        avg.steps < 8000 ? 'lightly active — below WHO recommended minimum of 8,000 steps' :
        avg.steps < 10000 ? 'approaching WHO target of 10,000 steps' :
        'meeting or exceeding WHO daily step target';

    const activityStatus =
        avg.activeMinutes < 10 ? 'critically inactive — well below ACSM minimum threshold of 22 min/day' :
        avg.activeMinutes < 22 ? 'insufficiently active — below ACSM daily recommended minimum (22 min)' :
        avg.activeMinutes < 40 ? 'moderately active — meeting basic ACSM guidelines' :
        'highly active — exceeding ACSM daily guidelines';

    const sleepStatus =
        avg.sleepHours < 5 ? 'severely sleep deprived — serious risk of immune suppression, cognitive impairment, and metabolic dysfunction (CDC)' :
        avg.sleepHours < 6 ? 'chronically sleep deprived — below CDC minimum, sustained health risk' :
        avg.sleepHours < 7 ? 'mildly sleep deprived — below CDC recommended range of 7–9 hrs' :
        avg.sleepHours <= 9 ? 'within CDC healthy sleep range (7–9 hrs)' :
        'oversleeping — above 9 hrs may indicate fatigue disorder or depression, monitor closely';

    const waterStatus =
        avg.waterMl < 1000 ? 'critically dehydrated — serious physiological risk' :
        avg.waterMl < 1500 ? 'significantly dehydrated — below safe minimum clinical threshold' :
        avg.waterMl < 2000 ? 'mildly dehydrated — below general clinical guideline of 2,000 ml/day' :
        avg.waterMl <= 3500 ? 'adequately hydrated — within clinical healthy range' :
        'well hydrated — above average, ensure it is intentional and not compensating for medication';

    const calorieStatus =
        avg.caloriesBurned === 0 ? 'no activity-based calorie expenditure logged — critical sedentary gap' :
        avg.caloriesBurned < 150 ? 'minimal activity expenditure — well below the 300–500 kcal/day clinical activity target' :
        avg.caloriesBurned < 300 ? 'low activity expenditure — approaching but below clinical minimum' :
        avg.caloriesBurned <= 600 ? 'healthy activity expenditure — within clinical target range' :
        'high activity expenditure — ensure adequate caloric intake and recovery to prevent overtraining';

    const breathingStatus =
        avg.breathingMinutes === 0 ? 'no mindfulness or guided breathing practised — significant stress management and HRV gap' :
        avg.breathingMinutes < 5 ? 'minimal breathing practice — below the 5–10 min/day clinical threshold for cortisol reduction' :
        avg.breathingMinutes < 10 ? 'light breathing practice — meeting minimum threshold, room to grow' :
        'consistent mindfulness practice — meeting or exceeding clinical recommendations';

    return `PATIENT CLINICAL WELLNESS SUMMARY (${days}-day average):

[PHYSICAL MOVEMENT]
- Daily Steps: ${avg.steps.toLocaleString()} steps/day → ${stepStatus}
- Active Minutes: ${avg.activeMinutes} min/day → ${activityStatus}
- Calories Burned (activity): ${avg.caloriesBurned} kcal/day → ${calorieStatus}

[SLEEP & RECOVERY]
- Sleep Duration: ${avg.sleepHours} hrs/night → ${sleepStatus}

[MINDFULNESS & STRESS]
- Guided Breathing: ${avg.breathingMinutes} min/day → ${breathingStatus}

[HYDRATION & NUTRITION]
- Water Intake: ${avg.waterMl} ml/day → ${waterStatus}

Using the clinical rules provided in your system instructions, generate a personalised 7-day wellness plan for this patient. Apply progressive overload (max 15% increase per metric). Prioritise the most critical deficits first. All 7 daily tasks must be specific, actionable, and time-bound.`;
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
            focusAreas: Array.isArray(parsedPlan.focusAreas) ? parsedPlan.focusAreas : [],
            weeklyInsight: typeof parsedPlan.weeklyInsight === 'string' ? parsedPlan.weeklyInsight : '',
            warnings: Array.isArray(parsedPlan.warnings) ? parsedPlan.warnings : [],
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
