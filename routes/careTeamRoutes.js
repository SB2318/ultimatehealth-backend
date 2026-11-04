const express = require("express");
const authToken = require("../middleware/authentcatetoken");
const {
    assignDoctor,
    getMyDoctors,
    getMyPatients,
    revokeDoctorConsent,
    createInteraction,
    getInteractions,
    emergencyBreakGlass,
    getPatientAuditDisclosures
} = require("../controllers/careTeamController");

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     CareTeamAssignment:
 *       type: object
 *       properties:
 *         patientId:
 *           type: string
 *         doctorId:
 *           type: string
 *         role:
 *           type: string
 *           enum: [primary_physician, specialist, nurse, wellness_coach]
 *         consentStatus:
 *           type: string
 *           enum: [pending, active, revoked]
 *         consentGrantedAt:
 *           type: string
 *           format: date-time
 *     CareInteraction:
 *       type: object
 *       properties:
 *         patientId:
 *           type: string
 *         doctorId:
 *           type: string
 *         authorRole:
 *           type: string
 *           enum: [doctor, patient]
 *         interactionType:
 *           type: string
 *           enum: [consultation_note, message, treatment_recommendation, prescription_note]
 *         subject:
 *           type: string
 *         content:
 *           type: string
 *         isAmendment:
 *           type: boolean
 *         signedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /care-team/assign:
 *   post:
 *     summary: Assign or invite a verified doctor to the patient's Care Team with active consent
 *     tags: [CareTeam]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - doctorId
 *             properties:
 *               doctorId:
 *                 type: string
 *               role:
 *                 type: string
 *                 example: primary_physician
 *               specialization:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Doctor successfully assigned with active consent
 */
router.post("/assign", authToken, assignDoctor);

/**
 * @swagger
 * /care-team/my-doctors:
 *   get:
 *     summary: View all doctors and clinical providers in the patient's Care Team
 *     tags: [CareTeam]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of Care Team providers
 */
router.get("/my-doctors", authToken, getMyDoctors);

/**
 * @swagger
 * /care-team/my-patients:
 *   get:
 *     summary: View assigned patient panel with active consent (Doctor role only)
 *     tags: [CareTeam]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of assigned patients
 *       403:
 *         description: Forbidden - doctor role required
 */
router.get("/my-patients", authToken, getMyPatients);

/**
 * @swagger
 * /care-team/revoke-consent:
 *   post:
 *     summary: Revoke patient consent for a Care Team doctor
 *     tags: [CareTeam]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - doctorId
 *             properties:
 *               doctorId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Consent successfully revoked
 */
router.post("/revoke-consent", authToken, revokeDoctorConsent);

/**
 * @swagger
 * /care-team/interactions:
 *   post:
 *     summary: Record a clinical consultation note, message, or amendment (Append-only)
 *     tags: [CareTeam]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               patientId:
 *                 type: string
 *               doctorId:
 *                 type: string
 *               interactionType:
 *                 type: string
 *                 example: consultation_note
 *               subject:
 *                 type: string
 *               content:
 *                 type: string
 *               isAmendment:
 *                 type: boolean
 *               originalNoteId:
 *                 type: string
 *               amendmentReason:
 *                 type: string
 *     responses:
 *       201:
 *         description: Care interaction or clinical note recorded
 */
router.post("/interactions", authToken, createInteraction);

/**
 * @swagger
 * /care-team/interactions/{patientId}:
 *   get:
 *     summary: Retrieve clinical consultation history and messages (Patient or Assigned Doctor)
 *     tags: [CareTeam]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Consultation history retrieved with audit logging
 */
router.get("/interactions/:patientId", authToken, getInteractions);

/**
 * @swagger
 * /care-team/break-glass:
 *   post:
 *     summary: Emergency break-glass access for licensed physicians with mandatory justification
 *     tags: [CareTeam]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - patientId
 *               - justification
 *             properties:
 *               patientId:
 *                 type: string
 *               justification:
 *                 type: string
 *                 example: Emergency clinical triage required for acute symptoms
 *     responses:
 *       200:
 *         description: Emergency access granted and logged as critical audit event
 */
router.post("/break-glass", authToken, emergencyBreakGlass);

/**
 * @swagger
 * /care-team/audit-disclosures:
 *   get:
 *     summary: HIPAA Accounting of Disclosures (§ 164.528) history for the patient
 *     tags: [CareTeam]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Immutable audit history of all access to patient ePHI
 */
router.get("/audit-disclosures", authToken, getPatientAuditDisclosures);

module.exports = router;
