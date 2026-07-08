const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const wellnessLogSchema = new mongoose.Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    date: {
        type: String, // Format: YYYY-MM-DD
        required: true,
    },
    metrics: {
        steps: {
            type: Number,
            default: 0
        },
        activeMinutes: {
            type: Number,
            default: 0
        },
        sleepHours: {
            type: Number,
            default: 0
        },
        waterMl: {
            type: Number,
            default: 0
        },
        caloriesBurned: {
            type: Number,
            default: 0
        },
        breathingSessionMinutes: {
            type: Number,
            default: 0
        }
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

// Ensure only one log per user per day
wellnessLogSchema.index({ userId: 1, date: 1 }, { unique: true });

// Update timestamp before saving
wellnessLogSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

const WellnessLog = mongoose.model('WellnessLog', wellnessLogSchema);

module.exports = WellnessLog;
