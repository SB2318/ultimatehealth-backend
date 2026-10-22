const express = require("express");
const router = express.Router();
const {
  submitApplicant,
  getAllApplicants,
  getApplicantById,
  updateApplicantStatus,
  createAdminFromApplicant,
  getMyAdminProfile,
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
 *     summary: Submit application directly from Admin Agreement landing page
 *     description: Alias for /admin/apply designed for applicant agreement onboarding flow.
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
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *               resume:
 *                 type: string
 *                 format: binary
 *     responses:
 *       '201':
 *         description: Application submitted successfully
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

module.exports = router;
