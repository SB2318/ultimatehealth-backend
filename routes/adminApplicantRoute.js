const express = require("express");
const router = express.Router();
const {
  submitApplicant,
  getAllApplicants,
  getApplicantById,
  updateApplicantStatus,
  createAdminFromApplicant,
  scheduleApplicantInterview,
  rejectApplicant,
  getMyAdminProfile,
  getAdminProfileById,
  toggleBlockAdmin,
  deleteAdminBySuperAdmin,
  getAllAdmins,
  getPlatformAnalyticsOverview,
} = require("../controllers/admin/adminApplicantController");
const {
  applicantResumeUpload,
} = require("../controllers/uploadController");
const { uploadLimiter } = require("../middleware/ratelimit");
const adminAuthenticateToken = require("../middleware/adminAuthenticateToken");
const requireSuperAdmin = require("../middleware/superAdminMiddleware");

/**
 * @openapi
 * /admin/apply:
 *   post:
 *     summary: Submit an application to become an Admin / Moderator / Reviewer
 *     description: Public endpoint allowing professionals to apply for admin or reviewer roles with resume attachment.
 *     tags:
 *       - Admin Applicants
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - email
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: Dr. Jane Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: jane.doe@example.com
 *               phone:
 *                 type: string
 *                 example: "+919876543210"
 *               role:
 *                 type: string
 *                 enum: ["Moderator", "Content Reviewer", "Admin", "Doctor/Medical Reviewer", "Other"]
 *                 example: "Doctor/Medical Reviewer"
 *               experience:
 *                 type: string
 *                 example: "5 years clinical experience in Cardiology"
 *               message:
 *                 type: string
 *                 example: "Passionate about medical content review."
 *               resume:
 *                 type: string
 *                 format: binary
 *                 description: Resume or CV file (PDF, DOC, DOCX, JPG, PNG up to 10MB)
 *               agreementScreenshot:
 *                 type: string
 *                 format: binary
 *                 description: Signed agreement screenshot or proof document (JPG, PNG, PDF up to 10MB)
 *     responses:
 *       '201':
 *         description: Application submitted successfully
 *       '400':
 *         description: Validation error or invalid file format
 *       '429':
 *         description: Rate limit exceeded
 */
router.post(
  "/admin/apply",
  uploadLimiter,
  applicantResumeUpload,
  submitApplicant
);

/**
 * @openapi
 * /admin-agreement/apply:
 *   post:
 *     summary: Submit digitally signed Admin Agreement and application
 *     description: >
 *       Public endpoint for applicant agreement onboarding flow.
 *       Accepts multipart/form-data containing applicant details, designation,
 *       audit message trail, and the digitally signed agreement PDF generated on canvas.
 *       Saves record to AdminApplicant collection, uploads PDF to S3, and emails
 *       official copies with attachment to both the applicant and administration team.
 *     tags:
 *       - Admin Applicants
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - email
 *             properties:
 *               fullName:
 *                 type: string
 *                 description: Verified legal name of the applicant
 *                 example: Dr. Jane Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Official contact email address
 *                 example: jane.doe@hospital.org
 *               phone:
 *                 type: string
 *                 description: Contact phone number with country code
 *                 example: "+919876543210"
 *               role:
 *                 type: string
 *                 description: Target role (e.g. Doctor/Medical Reviewer, Moderator, Admin)
 *                 example: Doctor/Medical Reviewer
 *               designation:
 *                 type: string
 *                 description: Professional designation or specialty
 *                 example: Consultant Neurologist
 *               experience:
 *                 type: string
 *                 description: Professional summary or years of clinical practice
 *                 example: 8+ years clinical review and cardiology research
 *               message:
 *                 type: string
 *                 description: Formatted agreement verification audit trail (timestamp, terms accepted, clinical boundaries)
 *                 example: "Agreement signed digitally on 2026-10-23T15:30:00Z. Accepted Code of Conduct & Clinical Review Guidelines."
 *               resume:
 *                 type: string
 *                 format: binary
 *                 description: Resume or CV file (PDF, DOC, DOCX up to 10MB)
 *               agreementScreenshot:
 *                 type: string
 *                 format: binary
 *                 description: Screenshot of signed agreement or agreement document
 *               agreement:
 *                 type: string
 *                 format: binary
 *                 description: Alternative field name for digitally signed agreement PDF / screenshot
 *     responses:
 *       '201':
 *         description: Application and agreement successfully submitted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Application submitted successfully. We have received your application and resume."
 *                 data:
 *                   type: object
 *                   properties:
 *                     applicationId:
 *                       type: string
 *                       example: "67204f12ab34cd56ef789012"
 *                     agreementUrl:
 *                       type: string
 *                       example: "https://ultimatehealth.blog/api/getFile/applicant-resumes/1729699200-Jane_Doe_Signed_Admin_Agreement.pdf"
 *                     resumeUrl:
 *                       type: string
 *                       example: "https://ultimatehealth.blog/api/getFile/applicant-resumes/1729699200-Jane_Doe_Signed_Admin_Agreement.pdf"
 *                     hasAttachment:
 *                       type: boolean
 *                       example: true
 *       '400':
 *         description: Validation error or unsupported file type
 *       '429':
 *         description: Rate limit exceeded (too many requests)
 *       '500':
 *         description: Internal server error
 */
router.post(
  "/admin-agreement/apply",
  uploadLimiter,
  applicantResumeUpload,
  submitApplicant
);

/**
 * @openapi
 * /admin/getmyadminprofile:
 *   get:
 *     summary: Get profile and review statistics of the authenticated Admin / SuperAdmin
 *     tags:
 *       - Admin Profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Authenticated admin profile details with contribution stats
 *       '401':
 *         description: Unauthorized
 */
router.get(
  "/admin/getmyadminprofile",
  adminAuthenticateToken,
  getMyAdminProfile
);

// Alias convenience route
router.get(
  "/admin/me",
  adminAuthenticateToken,
  getMyAdminProfile
);

/**
 * SuperAdmin Exclusive Endpoints:
 * Protected by adminAuthenticateToken + requireSuperAdmin (isSuperAdmin: true)
 */

/**
 * @openapi
 * /admin/applicants:
 *   get:
 *     summary: List all admin applicants (Super Admin only)
 *     description: Retrieve a paginated list of applicants filtered by status or role.
 *     tags:
 *       - Admin Applicants
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Pending, Under Review, Approved, Rejected]
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       '200':
 *         description: Paginated list of applicants
 *       '401':
 *         description: Admin authentication required
 *       '403':
 *         description: Super Admin privileges required
 */
router.get(
  "/admin/applicants",
  adminAuthenticateToken,
  requireSuperAdmin,
  getAllApplicants
);

/**
 * @openapi
 * /admin/applicants/{id}:
 *   get:
 *     summary: Get details of a specific admin applicant (Super Admin only)
 *     tags:
 *       - Admin Applicants
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Applicant details including resume URL
 *       '404':
 *         description: Applicant not found
 */
router.get(
  "/admin/applicants/:id",
  adminAuthenticateToken,
  requireSuperAdmin,
  getApplicantById
);

/**
 * @openapi
 * /admin/applicants/{id}/status:
 *   put:
 *     summary: Update applicant review status and stage (Super Admin only)
 *     description: |
 *       Updates applicant status across the 3 lifecycle stages:
 *       - **Stage 1 (Under Review)**: Initial review of candidate credentials and signed agreement.
 *       - **Stage 2 (Interview Scheduled)**: Schedules interview and automatically dispatches Google Meet link to applicant.
 *       - **Stage 3 (Approved / Rejected)**: Final decision; dispatches approval credentials or rejection feedback.
 *     tags:
 *       - Admin Applicants
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: MongoDB ObjectId of the AdminApplicant
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: ["Pending", "Under Review", "Interview Scheduled", "Approved", "Rejected"]
 *                 example: "Interview Scheduled"
 *               meetLink:
 *                 type: string
 *                 description: Google Meet link to be included in the candidate notification email
 *                 example: "https://meet.google.com/abc-defg-hij"
 *               interviewDate:
 *                 type: string
 *                 description: Date and time of the scheduled meeting / interview
 *                 example: "2026-10-30 14:00 IST"
 *               reviewNotes:
 *                 type: string
 *                 description: Internal or external reviewer notes
 *                 example: "Candidate profile verified. Proceeding to clinical review interview."
 *               rejectionReason:
 *                 type: string
 *                 description: Specific reason if rejecting the application
 *                 example: "Requires at least 3 years active clinical practice certification."
 *     responses:
 *       '200':
 *         description: Applicant status updated successfully and notification email dispatched
 *       '400':
 *         description: Validation error or invalid status
 *       '404':
 *         description: Applicant not found
 *   patch:
 *     summary: Partial update of applicant status, Google Meet link, or notes (Super Admin only)
 *     tags:
 *       - Admin Applicants
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: ["Pending", "Under Review", "Interview Scheduled", "Approved", "Rejected"]
 *               meetLink:
 *                 type: string
 *               interviewDate:
 *                 type: string
 *               reviewNotes:
 *                 type: string
 *               rejectionReason:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Status updated successfully
 */
router.put(
  "/admin/applicants/:id/status",
  adminAuthenticateToken,
  requireSuperAdmin,
  updateApplicantStatus
);

router.patch(
  "/admin/applicants/:id/status",
  adminAuthenticateToken,
  requireSuperAdmin,
  updateApplicantStatus
);

/**
 * @openapi
 * /admin/applicants/{id}/schedule-interview:
 *   post:
 *     summary: Schedule Stage 2 Interview & Send Google Meet link (Super Admin only)
 *     description: |
 *       Transitions applicant to Stage 2 (**Interview Scheduled**), stores the Google Meet link,
 *       and automatically sends an interview invitation email containing the Google Meet link and guidelines.
 *     tags:
 *       - Admin Applicants
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - meetLink
 *             properties:
 *               meetLink:
 *                 type: string
 *                 format: uri
 *                 description: Google Meet URL for the interview
 *                 example: "https://meet.google.com/uh-interview-2026"
 *               interviewDate:
 *                 type: string
 *                 description: Scheduled date and time
 *                 example: "Friday, Oct 30, 2026 at 3:00 PM IST"
 *               reviewNotes:
 *                 type: string
 *                 description: Instructions or preparation notes for the applicant
 *                 example: "Please bring your medical registration certificate and ID proof."
 *     responses:
 *       '200':
 *         description: Interview scheduled and Google Meet link email sent to applicant
 *       '400':
 *         description: Google Meet link is required
 *       '404':
 *         description: Applicant not found
 */
router.post(
  "/admin/applicants/:id/schedule-interview",
  adminAuthenticateToken,
  requireSuperAdmin,
  scheduleApplicantInterview
);

/**
 * @openapi
 * /admin/applicants/{id}/approve:
 *   post:
 *     summary: Approve applicant, create Admin profile & send credentials with password change instructions (Super Admin only - Stage 3a)
 *     description: |
 *       Formally approves the applicant at Stage 3:
 *       1. Creates a verified Admin / Moderator account in MongoDB.
 *       2. Hashes a secure temporary password.
 *       3. Dispatches an **Approval Email** containing username, email, temporary password, login URL, and step-by-step instructions on how to change password later.
 *     tags:
 *       - Admin Applicants
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [Moderator, "Super Admin"]
 *                 default: Moderator
 *               customPassword:
 *                 type: string
 *                 description: Optional custom initial password (otherwise secure password is generated automatically)
 *     responses:
 *       '201':
 *         description: Applicant approved, Admin account created, and approval credentials email dispatched
 *       '409':
 *         description: Admin with this email already exists
 */
router.post(
  "/admin/applicants/:id/approve",
  adminAuthenticateToken,
  requireSuperAdmin,
  createAdminFromApplicant
);

/**
 * @openapi
 * /admin/applicants/{id}/reject:
 *   post:
 *     summary: Reject applicant & send rejection email (Super Admin only - Stage 3b)
 *     description: |
 *       Transitions applicant to Stage 3b (**Rejected**), saves reviewer feedback,
 *       and dispatches a professional Rejection Email to the candidate.
 *     tags:
 *       - Admin Applicants
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Specific explanation for rejection
 *                 example: "Does not meet minimum 3 years clinical review experience criteria."
 *               reviewNotes:
 *                 type: string
 *                 description: Additional notes from committee
 *     responses:
 *       '200':
 *         description: Applicant rejected and rejection notification email dispatched
 *       '404':
 *         description: Applicant not found
 */
router.post(
  "/admin/applicants/:id/reject",
  adminAuthenticateToken,
  requireSuperAdmin,
  rejectApplicant
);

/**
 * @openapi
 * /admin/applicants/{id}/create-admin:
 *   post:
 *     summary: Create Admin profile directly from an Approved applicant (Super Admin only)
 *     description: Provisions an Admin / Moderator account, hashes a temporary password, and dispatches agreement onboarding email.
 *     tags:
 *       - Admin Applicants
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [Moderator, "Super Admin"]
 *                 default: Moderator
 *               customPassword:
 *                 type: string
 *     responses:
 *       '201':
 *         description: Admin account created successfully and verification email dispatched
 *       '409':
 *         description: Admin with this email already exists
 */
router.post(
  "/admin/applicants/:id/create-admin",
  adminAuthenticateToken,
  requireSuperAdmin,
  createAdminFromApplicant
);

/**
 * @openapi
 * /admin/admins:
 *   get:
 *     summary: List all Admins/Moderators (Super Admin only)
 *     tags:
 *       - Admin Management
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: List of admins
 */
router.get(
  "/admin/admins",
  adminAuthenticateToken,
  requireSuperAdmin,
  getAllAdmins
);

/**
 * @openapi
 * /admin/admins/{id}/block:
 *   put:
 *     summary: Block or unblock an Admin account (Super Admin only)
 *     tags:
 *       - Admin Management
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isBlocked:
 *                 type: boolean
 *     responses:
 *       '200':
 *         description: Admin blocked/unblocked status updated
 */
router.put(
  "/admin/admins/:id/block",
  adminAuthenticateToken,
  requireSuperAdmin,
  toggleBlockAdmin
);

router.patch(
  "/admin/admins/:id/block",
  adminAuthenticateToken,
  requireSuperAdmin,
  toggleBlockAdmin
);

/**
 * @openapi
 * /admin/admins/{id}:
 *   delete:
 *     summary: Delete an Admin account permanently (Super Admin only)
 *     tags:
 *       - Admin Management
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Admin deleted successfully
 */
router.delete(
  "/admin/admins/:id",
  adminAuthenticateToken,
  requireSuperAdmin,
  deleteAdminBySuperAdmin
);

// Extended Block & Status Endpoints
router.put(
  "/admin/admins/:id/status",
  adminAuthenticateToken,
  requireSuperAdmin,
  toggleBlockAdmin
);
router.patch(
  "/admin/admins/:id/status",
  adminAuthenticateToken,
  requireSuperAdmin,
  toggleBlockAdmin
);
router.put(
  "/admin/:id/status",
  adminAuthenticateToken,
  requireSuperAdmin,
  toggleBlockAdmin
);
router.patch(
  "/admin/:id/status",
  adminAuthenticateToken,
  requireSuperAdmin,
  toggleBlockAdmin
);
router.put(
  "/admin/:id/block",
  adminAuthenticateToken,
  requireSuperAdmin,
  toggleBlockAdmin
);
router.patch(
  "/admin/:id/block",
  adminAuthenticateToken,
  requireSuperAdmin,
  toggleBlockAdmin
);

// Super Admin Platform Analytics (Registered before wildcard :id)
router.get(
  "/admin/platform-analytics",
  adminAuthenticateToken,
  requireSuperAdmin,
  getPlatformAnalyticsOverview
);
router.get(
  "/admin/analytics/overview",
  adminAuthenticateToken,
  requireSuperAdmin,
  getPlatformAnalyticsOverview
);

// Admin Profile Dossier by ID
router.get(
  "/admin/profile/:id",
  adminAuthenticateToken,
  requireSuperAdmin,
  getAdminProfileById
);
router.get(
  "/admin/admins/:id",
  adminAuthenticateToken,
  requireSuperAdmin,
  getAdminProfileById
);
router.get(
  "/admin/:id",
  adminAuthenticateToken,
  requireSuperAdmin,
  getAdminProfileById
);

module.exports = router;
