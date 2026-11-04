const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const wellnessLogSchema = new mongoose.Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    date: {
        type: String,
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
    sharedWithCareTeam: {
        type: Boolean,
        default: false,
        index: true
    },
    sharedAt: {
        type: Date,
        default: null
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

wellnessLogSchema.index({ userId: 1, date: 1 }, { unique: true });
wellnessLogSchema.index({ userId: 1, sharedWithCareTeam: 1, date: -1 });

wellnessLogSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    if (this.isModified('sharedWithCareTeam') && this.sharedWithCareTeam && !this.sharedAt) {
        this.sharedAt = Date.now();
    }
    next();
});

const WellnessLog = mongoose.model('WellnessLog', wellnessLogSchema);

module.exports = WellnessLog;
