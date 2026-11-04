const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const auditLogSchema = new mongoose.Schema({
    actorId: {
        type: Schema.Types.ObjectId,
        required: true,
        index: true
    },
    actorRole: {
        type: String,
        enum: ['patient', 'doctor', 'admin', 'system'],
        default: 'patient'
    },
    patientId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        index: true
    },
    action: {
        type: String,
        enum: [
            'VIEW_LOGS',
            'CREATE_LOG',
            'UPDATE_LOG',
            'VIEW_CARE_TEAM',
            'ASSIGN_CARE_TEAM',
            'REVOKE_CARE_TEAM',
            'CREATE_NOTE',
            'VIEW_NOTES',
            'EXPORT_DATA',
            'BREAK_GLASS_ACCESS'
        ],
        required: true
    },
    resourceType: {
        type: String,
        enum: ['WellnessLog', 'CareTeam', 'CareInteraction', 'UserProfile'],
        required: true
    },
    resourceId: {
        type: Schema.Types.ObjectId
    },
    ipAddress: {
        type: String,
        default: '0.0.0.0'
    },
    userAgent: {
        type: String,
        default: 'unknown'
    },
    severity: {
        type: String,
        enum: ['info', 'warning', 'critical'],
        default: 'info'
    },
    status: {
        type: String,
        enum: ['success', 'failure'],
        default: 'success'
    },
    details: {
        type: Schema.Types.Mixed,
        default: {}
    },
    timestamp: {
        type: Date,
        default: Date.now,
        immutable: true
    }
});

auditLogSchema.index({ patientId: 1, timestamp: -1 });
auditLogSchema.index({ actorId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });

auditLogSchema.pre('updateOne', function (next) {
    next(new Error('HIPAA compliance violation: Audit log entries cannot be modified.'));
});

auditLogSchema.pre('findOneAndUpdate', function (next) {
    next(new Error('HIPAA compliance violation: Audit log entries cannot be modified.'));
});

auditLogSchema.pre('deleteOne', function (next) {
    next(new Error('HIPAA compliance violation: Audit log entries cannot be deleted.'));
});

auditLogSchema.pre('findOneAndDelete', function (next) {
    next(new Error('HIPAA compliance violation: Audit log entries cannot be deleted.'));
});

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
