const bcrypt = require("bcrypt");
const expressAsyncHandler = require("express-async-handler");
const admin = require('../../models/admin/adminModel')
const User = require("../../models/UserModel");
const UnverifiedUser = require('../../models/UnverifiedUserModel');
const { deleteFileFn } = require('../uploadController');
const {
  generateAccessToken,
  generateRefreshToken,
  generateVerificationToken,
  generatePasswordResetToken,
  verifyPasswordResetToken,
  generateOtp,
  hashToken,
  revokeRefreshToken,
  blacklistAccessToken,
  revokeAllUserTokens,
} = require("../../services/security/tokenService");
const {
  findAdminByEmail,
  updateAdminOtp,
  incrementOtpAttemptsAdmin,
  clearOtpAdmin,
  updateAdminPasswordAndClearOtp,
} = require("../../services/db/adminService");
const { isSamePassword } = require("../../services/security/encryptService");
const { sendOtpMail } = require("../emailservice");
const { throwError } = require("../../utils/throwError");
const { sendSuccess } = require("../../utils/response");
const { HTTP_STATUS, ERROR_CODES } = require("../../constants/errorConstants");
const redis = require("../../config/redis");

module.exports.register = expressAsyncHandler(
  async (req, res) => {
    try {
      const {
        user_name,
        user_handle,
        email,
        Profile_avtar,
        password,
      } = req.body;

      // Check for required fields
      if (!user_name || !user_handle || !email || !password) {
        return res
          .status(400)
          .json({ error: "Please provide all required fields" });
      }

      // Check if user already exists in User or UnverifiedUser collections

      const [existingAdmin, existingUserHandle, existingUser, existingUnverifiedUser] =
        await Promise.all([
          await admin.findOne({ email }),
          await admin.findOne({ user_handle }),
          await User.findOne({ email }),
          await UnverifiedUser.findOne({ email })
        ])

      if (existingUser || existingAdmin || existingUserHandle || existingUnverifiedUser) {
        return res.status(400).json({ error: "Email already in use" });
      }

      if (existingUserHandle) {
        return res.status(400).json({ error: "User Handle already in use" });
      }


      // Hash the password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Generate a verification token
      const verificationToken = generateVerificationToken({ email });

      // Create new unverified user
      const adminuser = new admin({
        user_name,
        user_handle,
        email,
        password: hashedPassword,
        Profile_avtar,
        verificationToken,
      });

      await adminuser.save();

      // Send verification email
      // sendVerificationEmail(email, verificationToken);

      res.status(201).json({
        message: "Registration successful. Please verify your email."
      });

    } catch (error) {
      console.error("Error during registration:", error);

      // Handle validation errors
      if (error.name === "ValidationError") {
        const validationErrors = Object.values(error.errors).map(
          (val) => val.message
        );
        return res.status(400).json({ error: validationErrors });
      }

      // Handle duplicate email/user handle error
      if (error.code === 11000) {
        return res
          .status(409)
          .json({ error: "Email or user handle already exists" });
      }

      // Handle general server errors
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

module.exports.login = expressAsyncHandler(
  async (req, res) => {
    try {
      const { email, password, fcmToken } = req.body;

      if (!email || !password || !fcmToken) {
        return res
          .status(400)
          .json({ error: "Please provide email and password and FCM Token" });
      }

      let user = await admin.findOne({ email });


      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (user.isVerified === false || !user.signature_url || user.signature_url === "") {
        return res
          .status(403)
          .json({ error: "Email not verified. Please check your email." });
      }


      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: "Invalid password" });
      }

      let tokenVersion = await redis.get(`user_token_version:${user._id}`);
      if (tokenVersion === null) {
        tokenVersion = 0;
        await redis.set(`user_token_version:${user._id}`, 0);
      }

      const { accessToken } = generateAccessToken({
        userId: user._id,
        email: user.email,
        role: 'admin',
        tokenVersion: parseInt(tokenVersion, 10),
      });

      const { refreshToken, jti } = await generateRefreshToken(user._id, {
        userId: user._id,
        email: user.email,
        role: 'admin',
      });

      user.fcmToken = fcmToken;
      await user.save();

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.status(200).json({
        message: "Login Successful",
        accessToken,
        refreshToken,
        user: {
          _id: user._id,
          email: user.email,
          user_name: user.user_name,
          user_handle: user.user_handle,
          isVerified: user.isVerified,
          role: 'admin',
        }
      });
    } catch (error) {
      console.log("Login Error", error);

      if (error.name === "ValidationError") {
        return res.status(400).json({ error: error.message });
      } else {
        return res.status(500).json({ error: "Internal server error" });
      }
    }
  }
);

module.exports.logout = expressAsyncHandler(
  async (req, res) => {
    try {
      if (req.tokenJti && req.tokenExp) {
        await blacklistAccessToken(req.tokenJti, req.tokenExp);
      }

      const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
      if (refreshToken) {
        const decoded = require('jsonwebtoken').decode(refreshToken);
        if (decoded?.jti && decoded?.userId) {
          await revokeRefreshToken(decoded.userId, decoded.jti);
        }
      }

      res.clearCookie("accessToken");
      res.clearCookie("refreshToken");

      res.status(200).json({ message: "Logout successful" });
    } catch (error) {
      console.error("Admin Logout Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

module.exports.getprofile = expressAsyncHandler(
  async (req, res) => {
    try {
      const user = await admin.findById(req.userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (!user.isVerified) {
        return res
          .status(403)
          .json({ error: "Email not verified. Please check your email." });
      }

      //const articleContributed = await Article.countDocuments({ reviewer_id: user._id, status: statusEnum.statusEnum.PUBLISHED });


      return res.json(user);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }

  }
);

// update user password
module.exports.updateAdminPassword = expressAsyncHandler(
  async (req, res) => {
    try {
      //const userId = req?.userId;
      const { new_password, email } = req.body;

      // Check if both old and new passwords are provided
      if (!new_password || !email) {
        return res.status(400).json({ error: "Missing passwords and email" });
      }

      // Check if the new password is long enough
      if (new_password.length < 6) {
        return res.status(400).json({ error: "Password too short" });
      }

      // Find the user by ID
      const user = await admin.findOne({ email });
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }


      // Ensure the new password is not the same as the old password
      const isSameAsOldPassword = await bcrypt.compare(
        new_password,
        user.password
      );
      if (isSameAsOldPassword) {
        return res.status(400).json({ error: "Same as old password" });
      }

      // Hash the new password
      const salt = await bcrypt.genSalt(10);
      const newHashedPassword = await bcrypt.hash(new_password, salt);

      // Update the user's password
      user.password = newHashedPassword;
      await user.save();
      res.json({ status: true, message: "Password updated" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// Edit profile: user_name, user_handle, password, profile_avtar

module.exports.editProfile = expressAsyncHandler(
  async (req, res) => {

    const { user_name, user_handle, password, profile_avtar } = req.body;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {

      const user = await admin.findById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      user.user_name = user_name || user.user_name;
      user.user_handle = user_handle || user.user_handle;
      user.profile_avtar = profile_avtar || user.profile_avtar;
      // encrypt password
      const isSameAsOldPassword = await bcrypt.compare(
        password,
        user.password
      );
      if (isSameAsOldPassword) {
        return res.status(400).json({ error: "Same as old password" });
      }

      // Hash the new password
      const salt = await bcrypt.genSalt(10);
      const newHashedPassword = await bcrypt.hash(password, salt);

      // Update the user's password
      user.password = newHashedPassword;
      await user.save();

      res.status(200).json({ status: true, message: "Profile updated" });

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// Duplicate logout function removed - using expressAsyncHandler version above

module.exports.deleteAdmin = expressAsyncHandler(
  async (req, res) => {

    try {
      const { password } = req.body;
      const user = await admin.findById(req.userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (!user.isVerified) {
        return res
          .status(403)
          .json({ error: "Email not verified. Please check your email." });
      }
      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        return res.status(401).json({ error: "Invalid password" });
      }
      // delete profile image from aws
      const avatar = user?.Profile_avtar;
      if (
        typeof avatar === "string" &&
        avatar.trim() !== "" &&
        !avatar.startsWith("http://") &&
        !avatar.startsWith("https://") &&
        !avatar.startsWith("//") &&
        !avatar.startsWith("data:")
      ) {
        await deleteFileFn(avatar);
      }

      await admin.deleteOne({ email: user.email });

      res.json({
        status: true,
        message: "account has been removed from database",
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

module.exports.sendAdminOTPForForgotPassword = expressAsyncHandler(
  async (req, res) => {
    const { email } = req.validateBody || req.body;

    const adminUser = await findAdminByEmail(email);

    // Uniform message to prevent user enumeration
    const successMessage = "OTP sent to your email.";

    if (!adminUser) {
      return sendSuccess(res, HTTP_STATUS.OK, successMessage);
    }
    if (adminUser.isBlockUser || adminUser.isBannedUser) {
      return sendSuccess(res, HTTP_STATUS.OK, successMessage);
    }
    if (!adminUser.isVerified) {
      return sendSuccess(res, HTTP_STATUS.OK, successMessage);
    }

    // Rate limit resend (default: 60 sec)
    const cooldownMs = (Number(process.env.OTP_RESEND_COOLDOWN_SECONDS) || 60) * 1000;
    if (
      adminUser.otpLastSentAt &&
      Date.now() - new Date(adminUser.otpLastSentAt).getTime() < cooldownMs
    ) {
      console.log(`OTP resend requested too soon for admin ${email}`);
      throwError(
        HTTP_STATUS.TOO_MANY_REQUESTS,
        "TOO_MANY_REQUESTS",
        "Please wait before requesting a new OTP."
      );
    }

    const otp = generateOtp(); // 6 digit
    const hashedOtp = hashToken(otp);
    const expiryMinutes = Number(process.env.OTP_EXPIRY_MINUTES) || 10;
    const otpExpires = new Date(Date.now() + expiryMinutes * 60 * 1000);

    const updatePayload = {
      otp: hashedOtp,
      otpExpires,
      otpLastSentAt: new Date(),
      otpAttempts: 0,
    };

    if (process.env.NODE_ENV === "production") {
      const result = await sendOtpMail(email, otp);

      if (!result) {
        throwError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          ERROR_CODES.INTERNAL_ERROR,
          "Failed to send OTP email",
        );
      }
    } else {
      console.log(`[DEV OTP] OTP for admin ${email}: ${otp}`);
      try {
        await sendOtpMail(email, otp);
      } catch (err) {
        console.warn("Mail sending skipped in dev:", err.message);
      }
    }

    await updateAdminOtp(adminUser._id, updatePayload);
    sendSuccess(res, HTTP_STATUS.OK, successMessage);
  }
);

module.exports.verifyAdminOtp = expressAsyncHandler(
  async (req, res) => {
    const { email, otp } = req.validateBody || req.body;

    const adminUser = await findAdminByEmail(email);

    if (!adminUser) {
      throwError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "Invalid or expired OTP",
      );
    }

    if (adminUser.isBlockUser || adminUser.isBannedUser) {
      throwError(
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.ACCESS_DENIED,
        "Account access restricted",
      );
    }

    if (!adminUser.otp || !adminUser.otpExpires) {
      throwError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "Invalid or expired OTP",
      );
    }

    const maxAttempts = Number(process.env.OTP_MAX_ATTEMPTS) || 5;

    if (adminUser.otpAttempts >= maxAttempts) {
      await clearOtpAdmin(adminUser._id);
      throwError(
        HTTP_STATUS.TOO_MANY_REQUESTS,
        ERROR_CODES.ACCESS_DENIED,
        "Too many invalid OTP attempts. Request a new OTP.",
      );
    }

    const hashedOtp = hashToken(otp);

    const isOtpInvalid =
      adminUser.otp !== hashedOtp || new Date(adminUser.otpExpires) < new Date();

    if (isOtpInvalid) {
      await incrementOtpAttemptsAdmin(adminUser._id);
      throwError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "Invalid or expired OTP",
      );
    }

    // OTP is valid - issue temporary password reset token (15 mins)
    const { resetToken, jti } = generatePasswordResetToken(
      { adminId: adminUser._id.toString(), email: adminUser.email },
      "15m"
    );

    try {
      await redis.setex(`password_reset_token:${adminUser._id.toString()}:${jti}`, 15 * 60, "valid");
    } catch (e) {
      console.warn("⚠️ Redis unavailable, skipping password reset token cache");
    }

    sendSuccess(res, HTTP_STATUS.OK, "OTP verified successfully", {
      resetToken,
    });
  }
);

module.exports.resetAdminPassword = expressAsyncHandler(
  async (req, res) => {
    const { resetToken, newPassword } = req.validateBody || req.body;

    const decoded = verifyPasswordResetToken(resetToken);
    if (!decoded || !decoded.adminId) {
      throwError(
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.UNAUTHORIZED_ACCESS,
        "Invalid or expired password reset token"
      );
    }

    try {
      const exists = await redis.get(`password_reset_token:${decoded.adminId}:${decoded.jti}`);
      if (exists === null && redis.status === "ready") {
        throwError(
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR,
          "Password reset token has already been used or expired"
        );
      }
      await redis.del(`password_reset_token:${decoded.adminId}:${decoded.jti}`);
    } catch (e) {
      if (e.status) throw e;
    }

    const adminUser = await admin.findById(decoded.adminId);
    if (!adminUser) {
      throwError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND,
        "Admin account not found"
      );
    }

    const isSame = await isSamePassword(newPassword, adminUser.password);
    if (isSame) {
      throwError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "New password must be different from old password"
      );
    }

    await updateAdminPasswordAndClearOtp(adminUser._id, newPassword);
    await revokeAllUserTokens(adminUser._id.toString());

    sendSuccess(res, HTTP_STATUS.OK, "Password reset successful");
  }
);


