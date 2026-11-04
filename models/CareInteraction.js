const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const careInteractionSchema = new mongoose.Schema({
    careTeamId: {
        type: Schema.Types.ObjectId,
        ref: 'CareTeam'
    },
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
    authorId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    authorRole: {
        type: String,
        enum: ['doctor', 'patient'],
        required: true
    },
    interactionType: {
        type: String,
        enum: [
            'consultation_note',
            'message',
            'treatment_recommendation',
            'prescription_note'
        ],
        default: 'message'
    },
    subject: {
        type: String,
        trim: true,
        default: ''
    },
    content: {
        type: String,
        required: true,
        trim: true
    },
    isAmendment: {
        type: Boolean,
        default: false
    },
    originalNoteId: {
        type: Schema.Types.ObjectId,
        ref: 'CareInteraction',
        default: null
    },
    amendmentReason: {
        type: String,
        default: null
    },
    signedAt: {
        type: Date,
        default: Date.now,
        immutable: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        immutable: true
    }
});

careInteractionSchema.index({ patientId: 1, createdAt: -1 });
careInteractionSchema.index({ doctorId: 1, createdAt: -1 });

careInteractionSchema.pre('updateOne', function (next) {
    next(new Error('HIPAA compliance violation: Clinical interactions and consultation notes are append-only. Use amendments to record updates.'));
});

careInteractionSchema.pre('findOneAndUpdate', function (next) {
    next(new Error('HIPAA compliance violation: Clinical interactions and consultation notes are append-only. Use amendments to record updates.'));
});

careInteractionSchema.pre('deleteOne', function (next) {
    next(new Error('HIPAA compliance violation: Medical records and care team interactions cannot be deleted.'));
});

careInteractionSchema.pre('findOneAndDelete', function (next) {
    next(new Error('HIPAA compliance violation: Medical records and care team interactions cannot be deleted.'));
});

const CareInteraction = mongoose.model('CareInteraction', careInteractionSchema);

module.exports = CareInteraction;
