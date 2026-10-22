const expressAsyncHandler = require("express-async-handler");
const { adminApplicantSchema } = require("../../validators/applicant.schema");
const { uploadApplicantResumeToS3 } = require("../uploadController");
const {
  createAdminApplicant,
  findAdminApplicantById,
  findAdminApplicants,
  updateAdminApplicantStatus,
} = require("../../services/db/applicantService");
const {
  sendAdminApplicationEmail,
  sendApplicantConfirmationEmail,
} = require("../emailservice");
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
    experience,
    message,
    resumeUrl: bodyResumeUrl,
  } = validationResult.data;

  let resumeUrl = bodyResumeUrl || "";
  let s3Key = "";
  let originalFileName = "";
  const emailAttachments = [];

  const uploadedFile =
    req.file ||
    (req.files && (req.files.resume?.[0] || req.files.file?.[0]));

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
    role: role || "Moderator",
    experience: experience || "",
    message: message || "",
    resumeUrl,
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

module.exports = {
  submitApplicant,
  getAllApplicants,
  getApplicantById,
  updateApplicantStatus,
};
