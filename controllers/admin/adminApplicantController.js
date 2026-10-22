const expressAsyncHandler = require("express-async-handler");
const { adminApplicantSchema } = require("../../validators/applicant.schema");
const { uploadApplicantResumeToS3 } = require("../uploadController");
const { createAdminApplicant } = require("../../services/db/adminService");
const {
  sendAdminApplicationEmail,
  sendApplicantConfirmationEmail,
} = require("../emailservice");
const { throwError } = require("../../utils/throwError");
const { sendSuccess } = require("../../utils/response");
const { HTTP_STATUS, ERROR_CODES } = require("../../constants/errorConstants");

/**
 * Submit Admin / Moderator / Reviewer Application
 * - Input validation via Zod
 * - File upload delegation to uploadController
 * - Database record creation via services/db/adminService
 * - Email notifications delegation to emailservice
 */
const submitApplicant = expressAsyncHandler(async (req, res) => {
  // Validate request body
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

  // Extract uploaded file from either req.file or req.files (resume or file field)
  const uploadedFile =
    req.file ||
    (req.files && (req.files.resume?.[0] || req.files.file?.[0]));

  // Handle uploaded file (if provided) via uploadController
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

    // Attach physical file directly to the email for instant preview
    emailAttachments.push({
      filename: uploadedFile.originalname,
      content: uploadedFile.buffer,
      contentType: uploadedFile.mimetype,
    });
  }

  // Save applicant record via services/db/adminService
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

  // Dispatch emails via emailservice (non-blocking)
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

module.exports = {
  submitApplicant,
};
