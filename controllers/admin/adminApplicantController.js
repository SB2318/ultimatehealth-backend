const expressAsyncHandler = require("express-async-handler");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const { adminApplicantSchema } = require("../../validators/applicant.schema");
const { uploadApplicantResumeToS3 } = require("../uploadController");
const Admin = require("../../models/admin/adminModel");
const Article = require("../../models/Articles");
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
      (req.files.resume?.[0] ||
        req.files.file?.[0] ||
        req.files.agreement?.[0] ||
        req.files.admin_agreement?.[0] ||
        req.files.document?.[0]));

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

module.exports = {
  submitApplicant,
  getAllApplicants,
  getApplicantById,
  updateApplicantStatus,
  createAdminFromApplicant,
  getMyAdminProfile,
};
