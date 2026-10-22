const express = require("express");
const router = express.Router();
const {
  submitApplicant,
} = require("../controllers/admin/adminApplicantController");
const {
  applicantResumeUpload,
} = require("../controllers/uploadController");
const { uploadLimiter } = require("../middleware/ratelimit");

/**
 * @route   POST /api/admin/apply
 * @desc    Submit an application to become an Admin / Moderator / Reviewer
 * @access  Public
 */
router.post(
  "/admin/apply",
  uploadLimiter,
  applicantResumeUpload,
  submitApplicant
);

/**
 * @route   POST /api/admin-agreement/apply
 * @desc    Alias endpoint for applying directly from the admin agreement page
 * @access  Public
 */
router.post(
  "/admin-agreement/apply",
  uploadLimiter,
  applicantResumeUpload,
  submitApplicant
);

module.exports = router;
