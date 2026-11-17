const AuditLog = require('../models/AuditLog');

const getClientIp = (req) => {
    if (req.ip) {
        return req.ip;
    }
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded && typeof forwarded === 'string') {
        const ips = forwarded.split(',').map(s => s.trim()).filter(Boolean);
        return ips[ips.length - 1] || '0.0.0.0';
    }
    return req.socket?.remoteAddress || '0.0.0.0';
};

const recordAuditLog = async ({
    actorId,
    actorRole = 'patient',
    patientId,
    action,
    resourceType,
    resourceId,
    ipAddress,
    userAgent,
    severity = 'info',
    status = 'success',
    details = {}
}) => {
    try {
        if (!actorId || !action || !resourceType) {
            return null;
        }

        const logEntry = new AuditLog({
            actorId,
            actorRole,
            patientId: patientId || actorId,
            action,
            resourceType,
            resourceId,
            ipAddress: ipAddress || '0.0.0.0',
            userAgent: userAgent || 'unknown',
            severity,
            status,
            details,
            timestamp: new Date()
        });

        await logEntry.save();
        return logEntry;
    } catch (err) {
        console.error('AuditLog writing error:', err.message);
        return null;
    }
};

module.exports = {
    getClientIp,
    recordAuditLog
};
