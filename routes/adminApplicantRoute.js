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

router.post(
  "/admin/apply",
  uploadLimiter,
  applicantResumeUpload,
  submitApplicant
);

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
