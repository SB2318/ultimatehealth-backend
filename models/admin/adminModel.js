const mongoose = require("mongoose");
const { Schema } = require("mongoose");
const validator = require("validator");

const adminSchema = new Schema({
  _id: {
    type: Schema.Types.ObjectId,
    auto: true,
  },
  user_name: {
    type: String,
    required: true,
  },
  user_handle: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: validator.isEmail,
      message: "{VALUE} is not a valid email",
      isAsync: false,
    },
  },

  otp: {
    type: String,
    default: null,
  },
  otpExpires: {
    type: Date,
    default: null,
  },
  otpLastSentAt: {
    type: Date,
    default: null,
  },
  otpAttempts: {
    type: Number,
    default: 0,
  },
  password: {
    type: String,
    required: true,
    minlength: [6, "Password must be at least 6 characters long"],
  },
  role: {
    type: String,
    required: true,
    enum: ["Super Admin", "Moderator"],
    default: "Moderator",
  },
  isSuperAdmin: {
    type: Boolean,
    default: false,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  Profile_avtar: {
    type: String,
    default: "",
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },

  isVerified: {
    type: Boolean,
    default: false,
  },
  verificationToken: {
    type: String,
    default: null,
  },
  fcmToken: { type: String, default: null },
  signature_url: {
    type: String,
    default: "",
  },
  refreshToken: {
    hashedRefreshToken: {
      type: String,
      default: null,
    },
    jti: {
      type: String,
      default: null,
    },
  },
});

adminSchema.pre("save", function (next) {
  if (
    this.email &&
    (this.email.toLowerCase() === "sb2318@it.jgec.ac.in" ||
      this.email.toLowerCase() === "sb2318@it,jgec.ac.in")
  ) {
    this.isSuperAdmin = true;
    this.role = "Super Admin";
  }
  next();
});

module.exports = mongoose.model("admin", adminSchema);

/**
 *
 * Super Admin: UltimateHealth itself
 * Moderators: All review team members
 */
