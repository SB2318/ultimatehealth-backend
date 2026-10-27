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
  sendApplicationApprovalEmail,
  sendApplicationRejectionEmail,
  sendApplicationStatusUpdateEmail,
} = require("../emailservice");
const { generateVerificationToken } = require("../../services/security/tokenService");
const { throwError } = require("../../utils/throwError");
const { sendSuccess } = require("../../utils/response");
const { HTTP_STATUS, ERROR_CODES } = require("../../constants/errorConstants");

/**
 * Submit Admin / Moderator / Reviewer Application (Public)
 */
const submitApplicant = expressAsyncHandler(async (req, res) => {
  // Normalize incoming fields from form-data / json
  if (req.body) {
    if (!req.body.fullName && (req.body.name || req.body.applicantName || req.body.userName)) {
      req.body.fullName = req.body.name || req.body.applicantName || req.body.userName;
    }
    if (!req.body.email && (req.body.userEmail || req.body.applicantEmail)) {
      req.body.email = req.body.userEmail || req.body.applicantEmail;
    }

    // Clean up "undefined" or "null" string literals from FormData
    for (const key of Object.keys(req.body)) {
      if (req.body[key] === "undefined" || req.body[key] === "null") {
        req.body[key] = "";
      }
    }
  }

  const validationResult = adminApplicantSchema.safeParse(req.body);

  if (!validationResult.success) {
    const errorDetails = validationResult.error.errors
      .map((e) => `${e.path.join('.') || 'field'}: ${e.message}`)
      .join(", ");
    console.error("❌ Admin applicant validation failed:", errorDetails, "Body:", req.body);
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
    agreementUrl: bodyAgreementUrl,
  } = validationResult.data;

  const finalRole = designation || role || "Moderator";
  let resumeUrl = bodyResumeUrl || req.body?.resume || req.body?.resume_url || "";
  let agreementUrl = bodyAgreementUrl || req.body?.agreement || req.body?.agreement_url || req.body?.agreementScreenshot || "";
  let s3Key = "";
  let agreementS3Key = "";
  let originalFileName = "";
  let agreementFileName = "";
  const emailAttachments = [];

  // Extract separate Resume and Agreement Screenshot files from multipart payload
  let resumeFile = null;
  let agreementFile = null;

  if (req.files) {
    const allFiles = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
    console.log("📥 Applicant files received:", allFiles.map((f) => ({ fieldname: f.fieldname, originalname: f.originalname, mimetype: f.mimetype, size: f.size })));

    // Pass 1: Explicit fieldname check
    for (const f of allFiles) {
      const fn = (f.fieldname || "").toLowerCase();
      if (
        fn === "agreement" ||
        fn === "agreementfile" ||
        fn === "agreement_file" ||
        fn === "agreementscreenshot" ||
        fn === "agreement_screenshot" ||
        fn === "screenshot" ||
        fn === "admin_agreement" ||
        fn === "adminagreement" ||
        fn === "proof" ||
        fn === "id_proof" ||
        fn === "certificate"
      ) {
        if (!agreementFile) agreementFile = f;
      } else if (
        fn === "resume" ||
        fn === "cv" ||
        fn === "resumefile" ||
        fn === "resume_file"
      ) {
        if (!resumeFile) resumeFile = f;
      }
    }

    // Pass 2: Substring matching on fieldname and originalname
    for (const f of allFiles) {
      if (f === resumeFile || f === agreementFile) continue;
      const fn = (f.fieldname || "").toLowerCase();
      const on = (f.originalname || "").toLowerCase();

      const isAgreement =
        fn.includes("agreement") ||
        fn.includes("screenshot") ||
        fn.includes("proof") ||
        fn.includes("sign") ||
        on.includes("agreement") ||
        on.includes("screenshot") ||
        on.includes("proof") ||
        on.includes("sign");

      const isResume =
        fn.includes("resume") ||
        fn.includes("cv") ||
        on.includes("resume") ||
        on.includes("cv");

      if (isAgreement && !agreementFile) {
        agreementFile = f;
      } else if (isResume && !resumeFile) {
        resumeFile = f;
      }
    }

    // Pass 3: Any remaining unassigned files
    for (const f of allFiles) {
      if (f === resumeFile || f === agreementFile) continue;
      if (!resumeFile) {
        resumeFile = f;
      } else if (!agreementFile) {
        agreementFile = f;
      }
    }
  } else if (req.file) {
    const fn = (req.file.fieldname || "").toLowerCase();
    const on = (req.file.originalname || "").toLowerCase();
    if (
      fn.includes("agreement") ||
      fn.includes("screenshot") ||
      fn.includes("proof") ||
      fn.includes("sign") ||
      on.includes("agreement") ||
      on.includes("screenshot") ||
      on.includes("proof") ||
      on.includes("sign")
    ) {
      agreementFile = req.file;
    } else {
      resumeFile = req.file;
    }
  }

  // 1. Upload Resume to S3 if provided
  if (resumeFile) {
    originalFileName = resumeFile.originalname;
    if (process.env.BUCKET_NAME && process.env.AWS_ACCESS_KEY_ID) {
      try {
        const s3Result = await uploadApplicantResumeToS3(
          resumeFile.buffer,
          `Resume-${fullName.replace(/\s+/g, '_')}-${resumeFile.originalname}`,
          resumeFile.mimetype
        );
        s3Key = s3Result.uniqueKey;
        resumeUrl = s3Result.resumeUrl;
        console.log("✅ Resume uploaded to S3:", resumeUrl);
      } catch (s3Err) {
        console.error(
          "⚠️ S3 resume upload failed, continuing with email attachment:",
          s3Err
        );
      }
    }

    emailAttachments.push({
      filename: `Resume_${resumeFile.originalname}`,
      content: resumeFile.buffer,
      contentType: resumeFile.mimetype,
    });
  }

  // 2. Upload Agreement File / Screenshot to S3 if provided
  if (agreementFile) {
    agreementFileName = agreementFile.originalname;
    if (!originalFileName) originalFileName = agreementFile.originalname;
    if (process.env.BUCKET_NAME && process.env.AWS_ACCESS_KEY_ID) {
      try {
        const s3Result = await uploadApplicantResumeToS3(
          agreementFile.buffer,
          `Agreement-${fullName.replace(/\s+/g, '_')}-${agreementFile.originalname}`,
          agreementFile.mimetype
        );
        agreementS3Key = s3Result.uniqueKey;
        agreementUrl = s3Result.resumeUrl;
        if (!s3Key) s3Key = agreementS3Key;
        console.log("✅ Agreement uploaded to S3:", agreementUrl);
      } catch (s3Err) {
        console.error(
          "⚠️ S3 agreement upload failed, continuing with email attachment:",
          s3Err
        );
      }
    }

    emailAttachments.push({
      filename: `Agreement_${agreementFile.originalname}`,
      content: agreementFile.buffer,
      contentType: agreementFile.mimetype,
    });
  }

  // Persist with independent resumeUrl and agreementUrl
  const newApplicant = await createAdminApplicant({
    fullName,
    email,
    phone: phone || "",
    role: finalRole,
    designation: designation || finalRole,
    experience: experience || "",
    message: message || "",
    resumeUrl: resumeUrl || "",
    agreementUrl: agreementUrl || "",
    s3Key: s3Key || "",
    agreementS3Key: agreementS3Key || "",
    originalFileName: originalFileName || "",
    agreementFileName: agreementFileName || "",
    status: "Pending",
  });

  sendAdminApplicationEmail({
    applicant: newApplicant,
    resumeUrl,
    agreementUrl,
    originalFileName,
    emailAttachments,
  }).catch((err) => {
    console.error("❌ Failed to send admin application email:", err);
  });

  sendApplicantConfirmationEmail({
    applicant: newApplicant,
    resumeUrl,
    agreementUrl,
    originalFileName,
    emailAttachments,
  }).catch((err) => {
    console.error("❌ Failed to send applicant confirmation email:", err);
  });

  return sendSuccess(
    res,
    HTTP_STATUS.CREATED,
    "Application submitted successfully. We have received your application, resume, and agreement.",
    {
      applicationId: newApplicant._id,
      resumeUrl: resumeUrl || undefined,
      agreementUrl: agreementUrl || undefined,
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
  const { status, reviewNotes, meetLink, interviewDate, rejectionReason } = req.body;

  const allowedStatuses = ["Pending", "Under Review", "Interview Scheduled", "Approved", "Accepted", "Rejected"];
  if (!status || !allowedStatuses.includes(status)) {
    throwError(
      HTTP_STATUS.BAD_REQUEST,
      ERROR_CODES.VALIDATION_ERROR,
      `Status must be one of: ${allowedStatuses.join(", ")}`
    );
  }

  const additionalFields = {};
  if (meetLink !== undefined) additionalFields.meetLink = meetLink;
  if (interviewDate !== undefined) additionalFields.interviewDate = interviewDate;
  if (rejectionReason !== undefined) additionalFields.rejectionReason = rejectionReason;

  const updatedApplicant = await updateAdminApplicantStatus(id, status, reviewNotes, additionalFields);
  if (!updatedApplicant) {
    throwError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.RESOURCE_NOT_FOUND, "Applicant not found");
  }

  // Automated Email Dispatches based on stage
  if (status === "Rejected") {
    // Stage 3b: Application Rejection Email
    sendApplicationRejectionEmail({
      email: updatedApplicant.email,
      fullName: updatedApplicant.fullName,
      role: updatedApplicant.designation || updatedApplicant.role || "Reviewer / Moderator",
      rejectionReason: rejectionReason || reviewNotes,
      reviewNotes,
    }).catch((err) => console.error("Failed to send rejection email:", err));
  } else {
    // Stage 1 & 2: Status update notification with Google Meet link if scheduled
    sendApplicationStatusUpdateEmail({
      email: updatedApplicant.email,
      fullName: updatedApplicant.fullName,
      status,
      meetLink: meetLink || updatedApplicant.meetLink,
      interviewDate: interviewDate || updatedApplicant.interviewDate,
      reviewNotes,
      role: updatedApplicant.designation || updatedApplicant.role || "Review Team Candidate",
    }).catch((err) => console.error("Failed to send status update email:", err));
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
  const tokenResult = generateVerificationToken({ email: applicant.email });
  const verificationToken = typeof tokenResult === 'object' && tokenResult.verificationToken ? tokenResult.verificationToken : tokenResult;

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

  // Dispatch Application Approval & Onboarding email with credentials & password change instructions
  try {
    // 2. Application Approval Email containing email, password, and password-change guide
    await sendApplicationApprovalEmail({
      email: applicant.email,
      fullName: applicant.fullName,
      user_handle,
      temporaryPassword: plainPassword,
      role: newAdmin.role,
    });

    // Also dispatch agreement onboarding verification link
    await sendAdminOnboardingEmail({
      email: applicant.email,
      fullName: applicant.fullName,
      user_handle,
      phone: applicant.phone || "",
      token: verificationToken,
      temporaryPassword: plainPassword,
    });
  } catch (emailErr) {
    console.error("Failed to dispatch admin approval onboarding emails:", emailErr);
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


/**
 * Superadmin-Specific: Schedule Interview & Send Google Meet Link (Stage 2)
 * Access: SuperAdmin only
 */
const scheduleApplicantInterview = expressAsyncHandler(async (req, res) => {
  const { id } = req.params;
  const { meetLink, interviewDate, reviewNotes } = req.body;

  if (!meetLink) {
    throwError(
      HTTP_STATUS.BAD_REQUEST,
      ERROR_CODES.VALIDATION_ERROR,
      "Google Meet link (meetLink) is required to schedule an interview"
    );
  }

  const updatedApplicant = await updateAdminApplicantStatus(
    id,
    "Interview Scheduled",
    reviewNotes || "Interview invitation scheduled with Google Meet link",
    { meetLink, interviewDate: interviewDate || "" }
  );

  if (!updatedApplicant) {
    throwError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.RESOURCE_NOT_FOUND, "Applicant not found");
  }

  // 4. Status Update: Send Google Meet link to applicant
  sendApplicationStatusUpdateEmail({
    email: updatedApplicant.email,
    fullName: updatedApplicant.fullName,
    status: "Interview Scheduled",
    meetLink,
    interviewDate,
    reviewNotes,
    role: updatedApplicant.designation || updatedApplicant.role,
  }).catch((err) => console.error("Failed to send interview schedule email:", err));

  return sendSuccess(
    res,
    HTTP_STATUS.OK,
    "Interview scheduled successfully and Google Meet link dispatched to applicant",
    updatedApplicant
  );
});

/**
 * Superadmin-Specific: Reject Applicant & Send Rejection Email (Stage 3b)
 * Access: SuperAdmin only
 */
const rejectApplicant = expressAsyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason, reviewNotes } = req.body;

  const rejectionReason = reason || reviewNotes || "Application does not meet current clinical requirements.";

  const updatedApplicant = await updateAdminApplicantStatus(
    id,
    "Rejected",
    reviewNotes || rejectionReason,
    { rejectionReason }
  );

  if (!updatedApplicant) {
    throwError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.RESOURCE_NOT_FOUND, "Applicant not found");
  }

  // 3. Application Rejection: Send rejection email
  sendApplicationRejectionEmail({
    email: updatedApplicant.email,
    fullName: updatedApplicant.fullName,
    role: updatedApplicant.designation || updatedApplicant.role,
    rejectionReason,
    reviewNotes,
  }).catch((err) => console.error("Failed to send rejection email:", err));

  return sendSuccess(
    res,
    HTTP_STATUS.OK,
    "Applicant rejected successfully and notification email dispatched",
    updatedApplicant
  );
});

module.exports = {
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
};
