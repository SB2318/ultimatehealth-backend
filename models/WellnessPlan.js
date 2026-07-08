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
        dailySteps: {
            type: Number,
            default: 0
        },
        dailyWaterMl: {
            type: Number,
            default: 0
        },
        dailySleepHours: {
            type: Number,
            default: 0
        },
        dailyActiveMinutes: {
            type: Number,
            default: 0
        }
    },
    dailyTasks: {
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
