const expressAsyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const WellnessLog = require('../models/WellnessLog');
const WellnessPlan = require('../models/WellnessPlan');
const CareTeam = require('../models/CareTeam');
const CareInteraction = require('../models/CareInteraction');
const User = require('../models/UserModel');
const { generateWithKeyRotation } = require('../services/geminiService');
const { getClientIp, recordAuditLog } = require('../middleware/hipaaAudit');

const PLAN_SYSTEM_INSTRUCTION = `You are a certified wellness physician and clinical health coach for UltimateHealth. You hold expertise in preventive medicine, sports medicine, sleep science, and behavioural nutrition. Your task is to analyse a patient's real logged health data and produce a personalised, evidence-based 7-day wellness plan that is medically sound, progressive, and motivating.

CLINICAL REFERENCE BENCHMARKS (use these when evaluating patient data):
- Daily Steps: WHO recommends 8,000-10,000 steps/day. Below 5,000 = sedentary risk (elevated CVD and metabolic syndrome risk).
- Active Minutes: ACSM recommends >= 150 min/week of moderate activity = ~22 min/day minimum. Below 15 min/day = critical inactivity.
- Sleep: CDC and Sleep Foundation recommend 7-9 hours/night for adults. Below 6 hrs = chronic sleep deprivation (immune, cognitive, and metabolic harm). Above 9 hrs may indicate underlying fatigue or depression.
- Water Intake: General clinical guideline is 2,000-3,500 ml/day for adults depending on body weight and activity level. Below 1,500 ml = significant dehydration risk.
- Calories Burned: A healthy active adult should burn >= 300-500 kcal through deliberate activity per day. Zero likely indicates no dedicated exercise.
- Guided Breathing / Mindfulness: Even 5-10 min/day of diaphragmatic breathing significantly reduces cortisol, improves HRV, and lowers resting heart rate. Zero indicates a gap in stress management and autonomic recovery.

PLAN GENERATION CLINICAL RULES:
1. PROGRESSIVE OVERLOAD SAFETY: Never increase any metric goal by more than 15% above the patient's 7-day average. Sudden large jumps cause injury, burnout, and non-adherence.
2. CRITICAL DEFICIT PRIORITISATION: If sleep is below 6 hrs, or steps are below 2,000, treat these as the highest priority deficits and build the plan around recovery first.
3. ZERO-VALUE HANDLING: If a metric is 0, assume the user is not yet tracking or practising it. Set a conservative, achievable starter goal (not the full clinical target) to build the habit gradually.
4. HOLISTIC COVERAGE: The plan must address all five wellness domains - (a) Physical Movement, (b) Sleep & Recovery, (c) Hydration & Nutrition, (d) Mental Wellness & Stress, (e) Mindfulness & Breathing. Do not focus on only one area.
5. DAILY TASKS: Generate exactly 7 daily tasks. Each task must be specific (include duration, quantity, or time of day), actionable (something the user can do today), and clinically grounded. Cover all 5 wellness domains across the 7 tasks.
6. FOCUS AREAS: Identify the 2 wellness domains that need the most urgent clinical improvement based on the patient's data.
7. WEEKLY INSIGHT: Write 1-2 sentences of clinical rationale explaining WHY the plan prioritises what it does, using plain language a patient can understand.
8. WARNINGS: List any clinical red flags present in the data (e.g., chronic sleep deprivation, severe sedentary behaviour, dehydration risk). Use an empty array if no concerns exist.
9. TONE: Encouraging but honest. Never alarm unnecessarily, but do not downplay genuine health risks.

OUTPUT FORMAT - respond with STRICT JSON only. No markdown, no code fences, no commentary. Match this exact schema:
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

    const totals = logs.reduce((acc, log) => {
        const m = log.metrics || {};
        acc.steps += m.steps || 0;
        acc.activeMinutes += m.activeMinutes || 0;
        acc.sleepHours += m.sleepHours || 0;
        acc.waterMl += m.waterMl || 0;
        acc.caloriesBurned += m.caloriesBurned || 0;
        acc.breathingMinutes += m.breathingSessionMinutes || 0;
        return acc;
    }, { steps: 0, activeMinutes: 0, sleepHours: 0, waterMl: 0, caloriesBurned: 0, breathingMinutes: 0 });

    const days = logs.length;
    const avg = {
        steps: Math.round(totals.steps / days),
        activeMinutes: Math.round(totals.activeMinutes / days),
        sleepHours: parseFloat((totals.sleepHours / days).toFixed(1)),
        waterMl: Math.round(totals.waterMl / days),
        caloriesBurned: Math.round(totals.caloriesBurned / days),
        breathingMinutes: Math.round(totals.breathingMinutes / days),
    };

    const stepStatus = avg.steps < 5000 ? "SEDENTARY DEFICIT" : avg.steps >= 8000 ? "OPTIMAL" : "MODERATE";
    const sleepStatus = avg.sleepHours < 6 ? "CRITICAL SLEEP DEFICIT" : avg.sleepHours >= 7 && avg.sleepHours <= 9 ? "OPTIMAL" : "SUB-OPTIMAL";
    const waterStatus = avg.waterMl < 1500 ? "DEHYDRATION RISK" : avg.waterMl >= 2000 ? "OPTIMAL" : "LOW";
    const activityStatus = avg.activeMinutes < 15 ? "INACTIVITY RISK" : avg.activeMinutes >= 22 ? "OPTIMAL" : "MODERATE";
    const calorieStatus = avg.caloriesBurned === 0 ? "NO TRACKED EXERCISE" : avg.caloriesBurned >= 300 ? "ACTIVE" : "LIGHT ACTIVITY";
    const breathingStatus = avg.breathingMinutes === 0 ? "NO GUIDED MINDFULNESS" : avg.breathingMinutes >= 5 ? "REGULAR PRACTICE" : "OCCASIONAL";

    return `PATIENT CLINICAL WELLNESS SUMMARY (${days}-day average):

[PHYSICAL MOVEMENT]
- Daily Steps: ${avg.steps.toLocaleString()} steps/day -> ${stepStatus}
- Active Minutes: ${avg.activeMinutes} min/day -> ${activityStatus}
- Calories Burned (activity): ${avg.caloriesBurned} kcal/day -> ${calorieStatus}

[SLEEP & RECOVERY]
- Sleep Duration: ${avg.sleepHours} hrs/night -> ${sleepStatus}

[MINDFULNESS & STRESS]
- Guided Breathing: ${avg.breathingMinutes} min/day -> ${breathingStatus}

[HYDRATION & NUTRITION]
- Water Intake: ${avg.waterMl} ml/day -> ${waterStatus}

Using the clinical rules provided in your system instructions, generate a personalised 7-day wellness plan for this patient. Apply progressive overload (max 15% increase per metric). Prioritise the most critical deficits first. All 7 daily tasks must be specific, actionable, and time-bound.`;
}

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

const logMetrics = expressAsyncHandler(async (req, res) => {
    try {
        const userId = req.userId;
        const { date, metrics, sharedWithCareTeam } = req.body;

        if (!date) {
            return res.status(400).json({ success: false, message: "Date is required (YYYY-MM-DD)" });
        }

        let log = await WellnessLog.findOne({ userId, date });
        const isUpdate = Boolean(log);

        if (log) {
            if (metrics) {
                log.metrics = { ...log.metrics.toObject(), ...metrics };
            }
            if (typeof sharedWithCareTeam === 'boolean') {
                log.sharedWithCareTeam = sharedWithCareTeam;
            }
            await log.save();
        } else {
            log = await WellnessLog.create({
                userId,
                date,
                metrics: metrics || {},
                sharedWithCareTeam: typeof sharedWithCareTeam === 'boolean' ? sharedWithCareTeam : false
            });
        }

        await recordAuditLog({
            actorId: userId,
            actorRole: 'patient',
            patientId: userId,
            action: isUpdate ? 'UPDATE_LOG' : 'CREATE_LOG',
            resourceType: 'WellnessLog',
            resourceId: log._id,
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'],
            details: { date, sharedWithCareTeam: log.sharedWithCareTeam }
        });

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

const getWeeklyMetrics = expressAsyncHandler(async (req, res) => {
    try {
        const userId = req.userId;

        const logs = await WellnessLog.find({ userId })
            .sort({ date: -1 })
            .limit(7);

        await recordAuditLog({
            actorId: userId,
            actorRole: 'patient',
            patientId: userId,
            action: 'VIEW_LOGS',
            resourceType: 'WellnessLog',
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent']
        });

        return res.status(200).json({
            success: true,
            data: logs
        });

    } catch (err) {
        console.error("Error fetching weekly metrics:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});

const getPatientLogsForDoctor = expressAsyncHandler(async (req, res) => {
    const doctorId = req.userId;
    const { patientId } = req.params;

    if (!patientId || !mongoose.Types.ObjectId.isValid(patientId)) {
        return res.status(400).json({ success: false, message: "Valid patientId parameter is required." });
    }

    const doctor = await User.findById(doctorId);
    if (!doctor || !doctor.isDoctor) {
        return res.status(403).json({ success: false, message: "Access restricted to licensed healthcare professionals." });
    }

    const careTeam = await CareTeam.findOne({
        patientId,
        doctorId,
        consentStatus: 'active'
    });

    if (!careTeam) {
        return res.status(403).json({
            success: false,
            message: "Patient has not granted active consent or assigned you to their Care Team."
        });
    }

    const logs = await WellnessLog.find({
        userId: patientId,
        sharedWithCareTeam: true
    }).sort({ date: -1 }).limit(30);

    await recordAuditLog({
        actorId: doctorId,
        actorRole: 'doctor',
        patientId,
        action: 'VIEW_LOGS',
        resourceType: 'WellnessLog',
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
        details: { logsRetrievedCount: logs.length }
    });

    return res.status(200).json({
        success: true,
        count: logs.length,
        data: logs
    });
});

const exportHealthData = expressAsyncHandler(async (req, res) => {
    const userId = req.userId;

    const user = await User.findById(userId).select('user_name user_handle email created_at');
    if (!user) {
        return res.status(404).json({ success: false, message: "User not found." });
    }

    const [logs, plans, careTeam, interactions] = await Promise.all([
        WellnessLog.find({ userId }).sort({ date: -1 }).lean(),
        WellnessPlan.find({ userId }).sort({ createdAt: -1 }).lean(),
        CareTeam.find({ patientId: userId }).populate('doctorId', 'user_name specialization qualification').lean(),
        CareInteraction.find({ patientId: userId }).sort({ createdAt: -1 }).lean()
    ]);

    await recordAuditLog({
        actorId: userId,
        actorRole: 'patient',
        patientId: userId,
        action: 'EXPORT_DATA',
        resourceType: 'UserProfile',
        resourceId: userId,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
        details: {
            logCount: logs.length,
            planCount: plans.length,
            interactionCount: interactions.length
        }
    });

    return res.status(200).json({
        success: true,
        complianceNotice: "HIPAA Right of Access export (45 CFR § 164.524)",
        generatedAt: new Date().toISOString(),
        patient: user,
        records: {
            wellnessLogs: logs,
            wellnessPlans: plans,
            careTeamAssignments: careTeam,
            clinicalInteractions: interactions
        }
    });
});

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

const getPlanHistory = expressAsyncHandler(async (req, res) => {
    try {
        const userId = req.userId;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
        const skip = (page - 1) * limit;

        const [plans, total] = await Promise.all([
            WellnessPlan.find({ userId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            WellnessPlan.countDocuments({ userId }),
        ]);

        return res.status(200).json({
            success: true,
            data: plans,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        });

    } catch (err) {
        console.error("Error fetching wellness plan history:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});

module.exports = {
    logMetrics,
    getWeeklyMetrics,
    getPatientLogsForDoctor,
    exportHealthData,
    generateAIPlan,
    getLatestPlan,
    getPlanHistory,
};
