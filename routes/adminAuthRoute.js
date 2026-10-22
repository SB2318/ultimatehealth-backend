const express = require("express");
const router = express.Router();
const {
  register,
  login,
  logout,
  getprofile,
  updateAdminPassword,
  editProfile,
  deleteAdmin,
  sendAdminOTPForForgotPassword,
  verifyAdminOtp,
  resetAdminPassword,
} = require('../controllers/admin/adminAuthController');
const {
  verifyEmail,
  Sendverifymail,
  resendVerificationEmail,
} = require("../controllers/emailservice");
const path = require("path");
const authenticateToken = require("../middleware/adminAuthenticateToken");
const { validateBody } = require("../middleware/validator");
const {
  forgotPasswordSchema,
  adminVerifyOtpSchema,
  adminResetPasswordSchema,
} = require("../validators/auth.schema");
const {
  forgotPasswordLimiter,
  otpLimiter,
} = require("../middleware/ratelimit");

const enforceMinDuration = (minDuration = 700) => {
  return async (req, res, next) => {
    const start = Date.now();
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    const delayIfNeeded = async () => {
      const elapsed = Date.now() - start;
      if (elapsed < minDuration) {
        await new Promise((resolve) =>
          setTimeout(resolve, minDuration - elapsed)
        );
      }
    };

    res.json = async (...args) => {
      await delayIfNeeded();
      return originalJson(...args);
    };

    res.send = async (...args) => {
      await delayIfNeeded();
      return originalSend(...args);
    };

    next();
  };
};

const { uploadAgreementPDF } = require("../controllers/uploadController");



router.post("/admin/register", register);




router.post("/admin/login", login);
router.post("/admin/upload-agreement",  uploadAgreementPDF);



router.post("/admin/logout", authenticateToken, logout);




router.get("/admin/verifyEmail", verifyEmail);



router.post("/admin/verifyEmail", Sendverifymail);


router.post("/admin/resend-verification-mail", resendVerificationEmail);


router.get('/admin/getprofile', authenticateToken, getprofile);

// Step 1: Send OTP to admin email
router.post(
  "/admin/forgot-password",
  enforceMinDuration(700),
  forgotPasswordLimiter,
  validateBody(forgotPasswordSchema),
  sendAdminOTPForForgotPassword
);

router.post(
  "/admin/forgotpassword",
  enforceMinDuration(700),
  forgotPasswordLimiter,
  validateBody(forgotPasswordSchema),
  sendAdminOTPForForgotPassword
);

// Step 2: Verify OTP and receive temporary resetToken
router.post(
  "/admin/verify-otp",
  enforceMinDuration(700),
  otpLimiter,
  validateBody(adminVerifyOtpSchema),
  verifyAdminOtp
);

// Step 3: Reset password using temporary resetToken
router.post(
  "/admin/reset-password",
  enforceMinDuration(700),
  otpLimiter,
  validateBody(adminResetPasswordSchema),
  resetAdminPassword
);

router.post('/admin/update-password', updateAdminPassword);


router.post('/admin/update-profile', authenticateToken, editProfile);



router.post("/admin/delete", authenticateToken, deleteAdmin);

router.get("/admin/delete-account", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "login-admin.html"));
});


router.get("/admin/agreement", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "admin-agreement.html"));
});


module.exports = router;


