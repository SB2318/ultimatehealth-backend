const expressAsyncHandler = require("express-async-handler");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const { adminApplicantSchema } = require("../../validators/applicant.schema");
const { uploadApplicantResumeToS3 } = require("../uploadController");
const Admin = require("../../models/admin/adminModel");
const AdminApplicant = require("../../models/admin/adminApplicantModel");
const Article = require("../../models/Articles");
const EditRequest = require("../../models/admin/articleEditRequestModel");
const { ReportAction, reportActionEnum } = require("../../models/admin/reportActionSchema");
const Specialization = require("../../models/SpecializationsModel");
const Language = require("../../models/Language");
const Glossary = require("../../models/Glossary");
const { statusEnum } = require("../../utils/StatusEnum");
const {
  createAdminApplicant,
  findAdminApplicantById,
  findAdminApplicants,
  updateAdminApplicantStatus,
} = require("../../services/db/applicantService");
const {
  sendAdminApplicationEmail,
  sendApplicantConfirmationEmail,
  sendAdminOnboardingEmail,
} = require("../emailservice");
const { generateVerificationToken } = require("../../services/security/tokenService");
const { throwError } = require("../../utils/throwError");
const { sendSuccess } = require("../../utils/response");
const { HTTP_STATUS, ERROR_CODES } = require("../../constants/errorConstants");

/**
 * Submit Admin / Moderator / Reviewer Application (Public)
 */
const submitApplicant = expressAsyncHandler(async (req, res) => {
  const validationResult = adminApplicantSchema.safeParse(req.body);

  if (!validationResult.success) {
    const errorDetails = validationResult.error.errors
      .map((e) => e.message)
      .join(", ");
    throwError(
      HTTP_STATUS.BAD_REQUEST,
      ERROR_CODES.VALIDATION_ERROR,
      errorDetails
    );
  }

  const {
    fullName,
    email,
    phone,
    role,
    designation,
    experience,
    message,
    resumeUrl: bodyResumeUrl,
  } = validationResult.data;

  const finalRole = designation || role || "Moderator";
  let resumeUrl = bodyResumeUrl || "";
  let s3Key = "";
  let originalFileName = "";
  const emailAttachments = [];

  const uploadedFile =
    req.file ||
    (req.files &&
      (Array.isArray(req.files)
        ? req.files[0]
        : (req.files.resume?.[0] ||
           req.files.proof?.[0] ||
           req.files.file?.[0] ||
           req.files.agreement?.[0] ||
           req.files.admin_agreement?.[0] ||
           req.files.document?.[0] ||
           req.files.id_proof?.[0] ||
           req.files.certificate?.[0] ||
           Object.values(req.files).flat()[0])));

  if (uploadedFile) {
    originalFileName = uploadedFile.originalname;

    if (process.env.BUCKET_NAME && process.env.AWS_ACCESS_KEY_ID) {
      try {
        const s3Result = await uploadApplicantResumeToS3(
          uploadedFile.buffer,
          uploadedFile.originalname,
          uploadedFile.mimetype
        );
        s3Key = s3Result.uniqueKey;
        resumeUrl = s3Result.resumeUrl;
      } catch (s3Err) {
        console.error(
          "⚠️ S3 resume upload failed, continuing with email attachment:",
          s3Err
        );
      }
    }

    emailAttachments.push({
      filename: uploadedFile.originalname,
      content: uploadedFile.buffer,
      contentType: uploadedFile.mimetype,
    });
  }

  const newApplicant = await createAdminApplicant({
    fullName,
    email,
    phone: phone || "",
    role: finalRole,
    designation: designation || finalRole,
    experience: experience || "",
    message: message || "",
    resumeUrl,
    agreementUrl: resumeUrl,
    s3Key,
    originalFileName,
    status: "Pending",
  });

  sendAdminApplicationEmail({
    applicant: newApplicant,
    resumeUrl,
    originalFileName,
    emailAttachments,
  }).catch((err) => {
    console.error("❌ Failed to send admin application email:", err);
  });

  sendApplicantConfirmationEmail({
    applicant: newApplicant,
    resumeUrl,
    agreementUrl: resumeUrl,
    originalFileName,
    emailAttachments,
  }).catch((err) => {
    console.error("❌ Failed to send applicant confirmation email:", err);
  });

  return sendSuccess(
    res,
    HTTP_STATUS.CREATED,
    "Application submitted successfully. We have received your application and resume.",
    {
      applicationId: newApplicant._id,
      resumeUrl: resumeUrl || undefined,
      agreementUrl: resumeUrl || undefined,
      hasAttachment: emailAttachments.length > 0,
    }
  );
});

/**
 * Superadmin-Specific: List all admin applicants with filters & pagination
 * Access: SuperAdmin only (isSuperAdmin: true)
 */
const getAllApplicants = expressAsyncHandler(async (req, res) => {
  const { status, role, search, page = 1, limit = 10 } = req.query;

  const filter = {};
  if (status) {
    filter.status = status;
  }
  if (role) {
    filter.role = role;
  }
  if (search) {
    const regex = new RegExp(search.trim(), "i");
    filter.$or = [{ fullName: regex }, { email: regex }];
  }

  const result = await findAdminApplicants(filter, { page, limit });

  return sendSuccess(res, HTTP_STATUS.OK, "Applicants retrieved successfully", result);
});

/**
 * Superadmin-Specific: Get details of a single applicant
 * Access: SuperAdmin only
 */
const getApplicantById = expressAsyncHandler(async (req, res) => {
  const { id } = req.params;

  const applicant = await findAdminApplicantById(id);
  if (!applicant) {
    throwError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.RESOURCE_NOT_FOUND, "Applicant not found");
  }

  return sendSuccess(res, HTTP_STATUS.OK, "Applicant retrieved successfully", applicant);
});

/**
 * Superadmin-Specific: Update applicant status (Approve, Reject, Review)
 * Access: SuperAdmin only
 */
const updateApplicantStatus = expressAsyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, reviewNotes } = req.body;

  const allowedStatuses = ["Pending", "Under Review", "Approved", "Rejected"];
  if (!status || !allowedStatuses.includes(status)) {
    throwError(
      HTTP_STATUS.BAD_REQUEST,
      ERROR_CODES.VALIDATION_ERROR,
      `Status must be one of: ${allowedStatuses.join(", ")}`
    );
  }

  const updatedApplicant = await updateAdminApplicantStatus(id, status, reviewNotes);
  if (!updatedApplicant) {
    throwError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.RESOURCE_NOT_FOUND, "Applicant not found");
  }

  return sendSuccess(
    res,
    HTTP_STATUS.OK,
    `Applicant status updated to ${status}`,
    updatedApplicant
  );
});

/**
 * Superadmin-Specific: Create Admin profile directly from an Approved Applicant
 * Access: SuperAdmin only
 */
const createAdminFromApplicant = expressAsyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role = "Moderator", customPassword } = req.body;

  const applicant = await findAdminApplicantById(id);
  if (!applicant) {
    throwError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.RESOURCE_NOT_FOUND, "Applicant not found");
  }

  // Check if admin already exists with this email
  const existingAdmin = await Admin.findOne({ email: applicant.email.toLowerCase() });
  if (existingAdmin) {
    throwError(
      HTTP_STATUS.CONFLICT,
      ERROR_CODES.ALREADY_EXISTS,
      "An admin account with this email already exists"
    );
  }

  // Generate unique handle from full name
  const baseHandle = applicant.fullName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 20);
  const randomSuffix = crypto.randomBytes(2).toString("hex");
  const user_handle = `${baseHandle}_${randomSuffix}`;

  // Generate password (or use provided)
  const plainPassword = customPassword || crypto.randomBytes(8).toString("hex") + "!Aa1";
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(plainPassword, salt);

  // Generate verification token for agreement signing
  const verificationToken = generateVerificationToken({ email: applicant.email });

  const newAdmin = new Admin({
    user_name: applicant.fullName,
    user_handle,
    email: applicant.email.toLowerCase(),
    password: hashedPassword,
    role: role || (applicant.role === "Admin" ? "Super Admin" : "Moderator"),
    verificationToken,
    isVerified: false,
    Profile_avtar: "",
  });

  await newAdmin.save();

  // Mark applicant status as Approved
  applicant.status = "Approved";
  applicant.reviewNotes = `Admin profile created with handle @${user_handle}`;
  await applicant.save();

  // Dispatch onboarding email with account details & registered phone
  try {
    await sendAdminOnboardingEmail({
      email: applicant.email,
      fullName: applicant.fullName,
      user_handle,
      phone: applicant.phone || "",
      token: verificationToken,
      temporaryPassword: customPassword ? undefined : plainPassword,
    });
  } catch (emailErr) {
    console.error("Failed to dispatch admin agreement verification email:", emailErr);
  }

  return sendSuccess(
    res,
    HTTP_STATUS.CREATED,
    "Admin profile created successfully from applicant data",
    {
      adminId: newAdmin._id,
      user_name: newAdmin.user_name,
      user_handle: newAdmin.user_handle,
      email: newAdmin.email,
      role: newAdmin.role,
      isVerified: newAdmin.isVerified,
      temporaryPassword: customPassword ? undefined : plainPassword,
    }
  );
});

/**
 * Get My Admin Profile: Sanitized profile of currently authenticated Admin/SuperAdmin
 * Access: Authenticated Admin
 */
const getMyAdminProfile = expressAsyncHandler(async (req, res) => {
  const adminId = req.userId;
  if (!adminId) {
    throwError(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED, "Admin authentication required");
  }

  const adminUser = await Admin.findById(adminId).select("-password -refreshToken -otp -verificationToken").lean();
  if (!adminUser) {
    throwError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.RESOURCE_NOT_FOUND, "Admin not found");
  }

  // Aggregate review stats
  const [articlesReviewed, glossaryReviewed] = await Promise.all([
    Article.countDocuments({
      reviewer_id: adminId,
      status: { $in: [statusEnum.PUBLISHED, statusEnum.DISCARDED] },
    }),
    Glossary.countDocuments({
      reviewerId: adminId,
      status: { $in: [statusEnum.PUBLISHED, statusEnum.DISCARDED] },
    }),
  ]);

  return sendSuccess(res, HTTP_STATUS.OK, "Admin profile retrieved successfully", {
    ...adminUser,
    stats: {
      articlesReviewed,
      glossaryReviewed,
      totalContributions: articlesReviewed + glossaryReviewed,
    },
  });
});

/**
 * Superadmin-Specific: Block or unblock an Admin account
 * Access: SuperAdmin only
 * Supports: PUT/PATCH /api/admin/admins/:id/block, PUT/PATCH /api/admin/:id/status
 * Body: { is_blocked?: boolean, isBlocked?: boolean, status?: string }
 */
const toggleBlockAdmin = expressAsyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throwError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.RESOURCE_NOT_FOUND, "Admin not found");
  }

  let targetBlockState;
  if (typeof req.body.is_blocked !== "undefined") {
    targetBlockState = Boolean(req.body.is_blocked);
  } else if (typeof req.body.isBlocked !== "undefined") {
    targetBlockState = Boolean(req.body.isBlocked);
  } else if (req.body.status) {
    targetBlockState = req.body.status.toLowerCase() === "suspended" || req.body.status.toLowerCase() === "blocked";
  }

  const targetAdmin = await Admin.findById(id);
  if (!targetAdmin) {
    throwError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.RESOURCE_NOT_FOUND, "Admin not found");
  }

  // Prevent Super Admin from blocking another Super Admin or themselves
  if (targetAdmin.isSuperAdmin) {
    throwError(HTTP_STATUS.FORBIDDEN, ERROR_CODES.FORBIDDEN, "Super Admin accounts cannot be blocked");
  }

  if (targetAdmin._id.toString() === req.userId.toString()) {
    throwError(HTTP_STATUS.BAD_REQUEST, ERROR_CODES.INVALID_INPUT, "You cannot block your own account");
  }

  targetAdmin.isBlocked = typeof targetBlockState === "boolean" ? targetBlockState : !targetAdmin.isBlocked;
  targetAdmin.updated_at = new Date();
  await targetAdmin.save();

  return sendSuccess(
    res,
    HTTP_STATUS.OK,
    `Admin account has been ${targetAdmin.isBlocked ? "blocked" : "unblocked"} successfully`,
    {
      adminId: targetAdmin._id,
      user_name: targetAdmin.user_name,
      user_handle: targetAdmin.user_handle,
      email: targetAdmin.email,
      isBlocked: targetAdmin.isBlocked,
      status: targetAdmin.isBlocked ? "suspended" : "active",
    }
  );
});

/**
 * Superadmin-Specific: Get extended Admin Profile Dossier by ID
 * Route: GET /api/admin/profile/:id, GET /api/admin/admins/:id, GET /api/admin/:id
 */
const getAdminProfileById = expressAsyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throwError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.RESOURCE_NOT_FOUND, "Admin not found");
  }

  const targetAdmin = await Admin.findById(id)
    .select("-password -refreshToken -otp -verificationToken")
    .lean();

  if (!targetAdmin) {
    throwError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.RESOURCE_NOT_FOUND, "Admin not found");
  }

  const [articlesReviewed, improvementsReviewed, reportsHandled] = await Promise.all([
    Article.countDocuments({ reviewer_id: id, is_removed: false }).catch(() => 0),
    EditRequest.countDocuments({ reviewer_id: id }).catch(() => 0),
    ReportAction.countDocuments({ admin_id: id }).catch(() => 0),
  ]);

  const permissions = {
    canReviewArticles: true,
    canInspectDiffs: true,
    canManageReports: true,
    canManageGlossary: true,
    canAuditGlobal: Boolean(targetAdmin.isSuperAdmin),
    canManageAdmins: Boolean(targetAdmin.isSuperAdmin),
  };

  return sendSuccess(res, HTTP_STATUS.OK, "Admin profile dossier retrieved successfully", {
    admin: {
      ...targetAdmin,
      status: targetAdmin.isBlocked ? "suspended" : "active",
    },
    permissions,
    metrics: {
      articlesReviewed,
      improvementsReviewed,
      reportsHandled,
    },
  });
});

/**
 * Superadmin-Specific: Platform Analytics & KPI Overview
 * Route: GET /api/admin/platform-analytics, GET /api/admin/analytics/overview
 */
const getPlatformAnalyticsOverview = expressAsyncHandler(async (req, res) => {
  const [
    totalAdmins,
    activeAdmins,
    suspendedAdmins,
    pendingApplicants,
    totalApplicants,
    unassignedArticles,
    inProgressArticles,
    publishedArticles,
    totalArticles,
    pendingReports,
    resolvedReports,
    totalSpecializations,
    totalLanguages,
  ] = await Promise.all([
    Admin.countDocuments().catch(() => 0),
    Admin.countDocuments({ isBlocked: false }).catch(() => 0),
    Admin.countDocuments({ isBlocked: true }).catch(() => 0),
    AdminApplicant.countDocuments({ status: "pending" }).catch(() => 0),
    AdminApplicant.countDocuments().catch(() => 0),
    Article.countDocuments({ status: statusEnum.UNASSIGNED, is_removed: false }).catch(() => 0),
    Article.countDocuments({ status: statusEnum.IN_PROGRESS, is_removed: false }).catch(() => 0),
    Article.countDocuments({ status: statusEnum.PUBLISHED, is_removed: false }).catch(() => 0),
    Article.countDocuments({ is_removed: false }).catch(() => 0),
    ReportAction.countDocuments({ action_taken: reportActionEnum.PENDING }).catch(() => 0),
    ReportAction.countDocuments({ action_taken: reportActionEnum.RESOLVED }).catch(() => 0),
    Specialization.countDocuments().catch(() => 0),
    Language.countDocuments().catch(() => 0),
  ]);

  return sendSuccess(res, HTTP_STATUS.OK, "Platform analytics overview retrieved successfully", {
    staffMetrics: {
      totalAdmins,
      activeAdmins,
      suspendedAdmins,
      pendingApplicants,
      totalApplicants,
    },
    contentMetrics: {
      unassignedArticles,
      inProgressArticles,
      publishedArticles,
      totalArticles,
      reviewQueueCount: unassignedArticles + inProgressArticles,
    },
    moderationMetrics: {
      pendingReports,
      resolvedReports,
      totalReports: pendingReports + resolvedReports,
    },
    masterDataMetrics: {
      totalSpecializations,
      totalLanguages,
    },
  });
});

/**
 * Superadmin-Specific: Delete an Admin account permanently
 * Access: SuperAdmin only
 */
const deleteAdminBySuperAdmin = expressAsyncHandler(async (req, res) => {
  const { id } = req.params;

  const targetAdmin = await Admin.findById(id);
  if (!targetAdmin) {
    throwError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.RESOURCE_NOT_FOUND, "Admin not found");
  }

  // Prevent Super Admin from deleting another Super Admin or themselves
  if (targetAdmin.isSuperAdmin) {
    throwError(HTTP_STATUS.FORBIDDEN, ERROR_CODES.FORBIDDEN, "Super Admin accounts cannot be deleted");
  }

  if (targetAdmin._id.toString() === req.userId.toString()) {
    throwError(HTTP_STATUS.BAD_REQUEST, ERROR_CODES.INVALID_INPUT, "You cannot delete your own account from this endpoint");
  }

  await Admin.findByIdAndDelete(id);

  return sendSuccess(
    res,
    HTTP_STATUS.OK,
    "Admin account deleted permanently by Super Admin",
    {
      deletedAdminId: id,
      user_handle: targetAdmin.user_handle,
    }
  );
});

/**
 * Superadmin-Specific: Get list of all Admins/Moderators
 * Access: SuperAdmin only
 */
const getAllAdmins = expressAsyncHandler(async (req, res) => {
  const { search, role, isBlocked, page = 1, limit = 20 } = req.query;

  const filter = {};
  if (role) filter.role = role;
  if (typeof isBlocked !== "undefined") filter.isBlocked = isBlocked === "true";
  if (search) {
    filter.$or = [
      { user_name: { $regex: search, $options: "i" } },
      { user_handle: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [admins, total] = await Promise.all([
    Admin.find(filter)
      .select("-password -refreshToken -otp -verificationToken")
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Admin.countDocuments(filter),
  ]);

  return sendSuccess(res, HTTP_STATUS.OK, "Admins retrieved successfully", {
    admins,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  });
});

module.exports = {
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
};
