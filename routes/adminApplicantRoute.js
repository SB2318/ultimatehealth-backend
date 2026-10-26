const express = require("express");
const router = express.Router();
const {
  submitApplicant,
  getAllApplicants,
  getApplicantById,
  updateApplicantStatus,
  createAdminFromApplicant,
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
 *                 description: Digitally signed agreement PDF (${fullName}_Signed_Admin_Agreement.pdf) or CV
 *               agreement:
 *                 type: string
 *                 format: binary
 *                 description: Alternative field name for digitally signed agreement PDF
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
 *     summary: Update applicant review status (Super Admin only)
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
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [Pending, Under Review, Approved, Rejected]
 *               reviewNotes:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Applicant status updated successfully
 */
router.put(
  "/admin/applicants/:id/status",
  adminAuthenticateToken,
  requireSuperAdmin,
  updateApplicantStatus
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
