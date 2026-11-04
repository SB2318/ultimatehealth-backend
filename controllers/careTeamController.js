const expressAsyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const CareTeam = require("../models/CareTeam");
const CareInteraction = require("../models/CareInteraction");
const User = require("../models/UserModel");
const AuditLog = require("../models/AuditLog");
const { getClientIp, recordAuditLog } = require("../middleware/hipaaAudit");

const assignDoctor = expressAsyncHandler(async (req, res) => {
    const patientId = req.userId;
    const { doctorId, role = 'primary_physician', specialization, notes } = req.body;

    if (!doctorId) {
        return res.status(400).json({ success: false, message: "Doctor ID is required." });
    }

    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
        return res.status(400).json({ success: false, message: "Invalid Doctor ID format." });
    }

    const doctor = await User.findById(doctorId);
    if (!doctor || !doctor.isDoctor) {
        return res.status(404).json({ success: false, message: "Specified provider was not found or is not a registered medical professional." });
    }

    let assignment = await CareTeam.findOne({ patientId, doctorId });

    if (assignment) {
        assignment.role = role;
        assignment.consentStatus = 'active';
        assignment.consentGrantedAt = new Date();
        assignment.consentRevokedAt = null;
        if (specialization) assignment.specialization = specialization;
        if (notes) assignment.notes = notes;
        await assignment.save();
    } else {
        assignment = await CareTeam.create({
            patientId,
            doctorId,
            role,
            consentStatus: 'active',
            consentGrantedAt: new Date(),
            specialization: specialization || doctor.specialization,
            notes
        });
    }

    await recordAuditLog({
        actorId: patientId,
        actorRole: 'patient',
        patientId,
        action: 'ASSIGN_CARE_TEAM',
        resourceType: 'CareTeam',
        resourceId: assignment._id,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
        details: { doctorId, role }
    });

    res.status(200).json({
        success: true,
        message: "Doctor successfully assigned to your Care Team with active consent.",
        data: assignment
    });
});

const getMyDoctors = expressAsyncHandler(async (req, res) => {
    const patientId = req.userId;

    const team = await CareTeam.find({ patientId })
        .populate('doctorId', 'user_name user_handle specialization qualification Years_of_experience Profile_image')
        .sort({ createdAt: -1 });

    await recordAuditLog({
        actorId: patientId,
        actorRole: 'patient',
        patientId,
        action: 'VIEW_CARE_TEAM',
        resourceType: 'CareTeam',
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent']
    });

    res.status(200).json({
        success: true,
        count: team.length,
        data: team
    });
});

const getMyPatients = expressAsyncHandler(async (req, res) => {
    const doctorId = req.userId;

    const doctor = await User.findById(doctorId);
    if (!doctor || !doctor.isDoctor) {
        return res.status(403).json({ success: false, message: "Access restricted to licensed healthcare professionals." });
    }

    const panel = await CareTeam.find({ doctorId, consentStatus: 'active' })
        .populate('patientId', 'user_name user_handle email created_at')
        .sort({ consentGrantedAt: -1 });

    await recordAuditLog({
        actorId: doctorId,
        actorRole: 'doctor',
        action: 'VIEW_CARE_TEAM',
        resourceType: 'CareTeam',
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent']
    });

    res.status(200).json({
        success: true,
        count: panel.length,
        data: panel
    });
});

const revokeDoctorConsent = expressAsyncHandler(async (req, res) => {
    const patientId = req.userId;
    const { doctorId } = req.body;

    if (!doctorId) {
        return res.status(400).json({ success: false, message: "Doctor ID is required." });
    }

    const assignment = await CareTeam.findOne({ patientId, doctorId });
    if (!assignment) {
        return res.status(404).json({ success: false, message: "No care team relationship found with this provider." });
    }

    assignment.consentStatus = 'revoked';
    assignment.consentRevokedAt = new Date();
    await assignment.save();

    await recordAuditLog({
        actorId: patientId,
        actorRole: 'patient',
        patientId,
        action: 'REVOKE_CARE_TEAM',
        resourceType: 'CareTeam',
        resourceId: assignment._id,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
        details: { doctorId }
    });

    res.status(200).json({
        success: true,
        message: "Consent revoked. The provider can no longer view your personal logs or care interactions.",
        data: assignment
    });
});

const createInteraction = expressAsyncHandler(async (req, res) => {
    const callerId = req.userId;
    const {
        patientId,
        doctorId,
        interactionType = 'message',
        subject = '',
        content,
        isAmendment = false,
        originalNoteId,
        amendmentReason
    } = req.body;

    if (!content || !content.trim()) {
        return res.status(400).json({ success: false, message: "Interaction content cannot be empty." });
    }

    const caller = await User.findById(callerId);
    if (!caller) {
        return res.status(401).json({ success: false, message: "Authenticated user not found." });
    }

    const authorRole = caller.isDoctor ? 'doctor' : 'patient';
    const targetPatientId = authorRole === 'patient' ? callerId : patientId;
    const targetDoctorId = authorRole === 'doctor' ? callerId : doctorId;

    if (!targetPatientId || !targetDoctorId) {
        return res.status(400).json({ success: false, message: "Both patientId and doctorId are required." });
    }

    const careTeam = await CareTeam.findOne({
        patientId: targetPatientId,
        doctorId: targetDoctorId,
        consentStatus: 'active'
    });

    if (!careTeam) {
        return res.status(403).json({
            success: false,
            message: "Active Care Team assignment and patient consent are required to record care interactions."
        });
    }

    if (isAmendment && !originalNoteId) {
        return res.status(400).json({
            success: false,
            message: "Amendments require a valid originalNoteId."
        });
    }

    const interaction = await CareInteraction.create({
        careTeamId: careTeam._id,
        patientId: targetPatientId,
        doctorId: targetDoctorId,
        authorId: callerId,
        authorRole,
        interactionType,
        subject,
        content: content.trim(),
        isAmendment,
        originalNoteId: originalNoteId || null,
        amendmentReason: amendmentReason || null,
        signedAt: new Date()
    });

    await recordAuditLog({
        actorId: callerId,
        actorRole,
        patientId: targetPatientId,
        action: 'CREATE_NOTE',
        resourceType: 'CareInteraction',
        resourceId: interaction._id,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
        details: { interactionType, isAmendment }
    });

    res.status(201).json({
        success: true,
        message: isAmendment ? "Clinical note amendment recorded." : "Care interaction successfully recorded.",
        data: interaction
    });
});

const getInteractions = expressAsyncHandler(async (req, res) => {
    const callerId = req.userId;
    const { patientId } = req.params;

    if (!patientId || !mongoose.Types.ObjectId.isValid(patientId)) {
        return res.status(400).json({ success: false, message: "Valid patientId parameter is required." });
    }

    const caller = await User.findById(callerId);
    if (!caller) {
        return res.status(401).json({ success: false, message: "User not found." });
    }

    const isPatientSelf = callerId.toString() === patientId.toString();

    if (!isPatientSelf) {
        if (!caller.isDoctor) {
            return res.status(403).json({ success: false, message: "Unauthorized access to patient records." });
        }

        const assignment = await CareTeam.findOne({
            patientId,
            doctorId: callerId,
            consentStatus: 'active'
        });

        if (!assignment) {
            return res.status(403).json({
                success: false,
                message: "No active care team relationship with this patient."
            });
        }
    }

    const interactions = await CareInteraction.find({ patientId })
        .populate('authorId', 'user_name user_handle isDoctor specialization Profile_image')
        .sort({ createdAt: 1 });

    await recordAuditLog({
        actorId: callerId,
        actorRole: caller.isDoctor ? 'doctor' : 'patient',
        patientId,
        action: 'VIEW_NOTES',
        resourceType: 'CareInteraction',
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent']
    });

    res.status(200).json({
        success: true,
        count: interactions.length,
        data: interactions
    });
});

const emergencyBreakGlass = expressAsyncHandler(async (req, res) => {
    const doctorId = req.userId;
    const { patientId, justification } = req.body;

    if (!patientId || !justification || justification.trim().length < 15) {
        return res.status(400).json({
            success: false,
            message: "Break-glass emergency access requires a valid patientId and a clinical justification (minimum 15 characters)."
        });
    }

    const doctor = await User.findById(doctorId);
    if (!doctor || !doctor.isDoctor) {
        return res.status(403).json({
            success: false,
            message: "Emergency break-glass access is strictly restricted to licensed medical practitioners."
        });
    }

    const patient = await User.findById(patientId);
    if (!patient) {
        return res.status(404).json({ success: false, message: "Patient not found." });
    }

    await recordAuditLog({
        actorId: doctorId,
        actorRole: 'doctor',
        patientId,
        action: 'BREAK_GLASS_ACCESS',
        resourceType: 'UserProfile',
        resourceId: patientId,
        severity: 'critical',
        status: 'success',
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
        details: {
            justification: justification.trim(),
            doctorName: doctor.user_name,
            doctorEmail: doctor.email
        }
    });

    res.status(200).json({
        success: true,
        message: "Emergency break-glass access logged. An urgent notification has been delivered to the compliance officer.",
        data: {
            patient: {
                id: patient._id,
                name: patient.user_name,
                email: patient.email
            },
            accessGrantedAt: new Date(),
            auditLogged: true
        }
    });
});

const getPatientAuditDisclosures = expressAsyncHandler(async (req, res) => {
    const patientId = req.userId;

    const disclosures = await AuditLog.find({ patientId })
        .populate('actorId', 'user_name user_handle isDoctor')
        .sort({ timestamp: -1 })
        .limit(100);

    res.status(200).json({
        success: true,
        count: disclosures.length,
        data: disclosures
    });
});

module.exports = {
    assignDoctor,
    getMyDoctors,
    getMyPatients,
    revokeDoctorConsent,
    createInteraction,
    getInteractions,
    emergencyBreakGlass,
    getPatientAuditDisclosures
};
