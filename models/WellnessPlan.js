const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const wellnessPlanSchema = new mongoose.Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    isActive: {
        type: Boolean,
        default: true
    },
    goals: {
        // Movement
        dailySteps: {
            type: Number,
            default: 0
        },
        dailyActiveMinutes: {
            type: Number,
            default: 0
        },
        dailyCaloriesBurned: {
            type: Number,
            default: 0
        },
        // Recovery & Rest
        dailySleepHours: {
            type: Number,
            default: 0
        },
        dailyBreathingMinutes: {
            type: Number,
            default: 0
        },
        // Nutrition & Hydration
        dailyWaterMl: {
            type: Number,
            default: 0
        }
    },
    // 7 specific, actionable daily tasks across all wellness domains
    dailyTasks: {
        type: [String],
        default: []
    },
    // Top 2 clinical domains that need the most improvement this week
    focusAreas: {
        type: [String],
        default: []
    },
    // 1-2 sentence clinical rationale explaining the plan's primary focus
    weeklyInsight: {
        type: String,
        default: ''
    },
    // Clinical warnings (e.g. severely low sleep, sedentary risk). Empty if no concerns.
    warnings: {
        type: [String],
        default: []
    },
    basedOnLogs: {
        type: [Schema.Types.ObjectId],
        ref: 'WellnessLog',
        default: []
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Speeds up the common "find this user's current active plan" lookup
wellnessPlanSchema.index({ userId: 1, isActive: 1 });

// Update timestamp before saving
wellnessPlanSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

const WellnessPlan = mongoose.model('WellnessPlan', wellnessPlanSchema);

module.exports = WellnessPlan;

