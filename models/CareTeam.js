const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const careTeamSchema = new mongoose.Schema({
    patientId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    doctorId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    role: {
        type: String,
        enum: ['primary_physician', 'specialist', 'nurse', 'wellness_coach'],
        default: 'primary_physician'
    },
    consentStatus: {
        type: String,
        enum: ['pending', 'active', 'revoked'],
        default: 'pending',
        index: true
    },
    consentGrantedAt: {
        type: Date,
        default: null
    },
    consentRevokedAt: {
        type: Date,
        default: null
    },
    specialization: {
        type: String,
        default: null
    },
    notes: {
        type: String,
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

careTeamSchema.index({ patientId: 1, doctorId: 1 }, { unique: true });

careTeamSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

const CareTeam = mongoose.model('CareTeam', careTeamSchema);

module.exports = CareTeam;
