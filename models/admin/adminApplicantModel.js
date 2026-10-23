const mongoose = require("mongoose");
const { Schema } = require("mongoose");
const validator = require("validator");

const adminApplicantSchema = new Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      maxlength: [100, "Full name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      validate: {
        validator: validator.isEmail,
        message: "{VALUE} is not a valid email",
      },
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    role: {
      type: String,
      trim: true,
      default: "Moderator",
    },
    designation: {
      type: String,
      trim: true,
      default: "",
    },
    experience: {
      type: String,
      trim: true,
      default: "",
    },
    message: {
      type: String,
      trim: true,
      default: "",
      maxlength: [3000, "Message cannot exceed 3000 characters"],
    },
    resumeUrl: {
      type: String,
      trim: true,
      default: "",
    },
    agreementUrl: {
      type: String,
      trim: true,
      default: "",
    },
    s3Key: {
      type: String,
      trim: true,
      default: "",
    },
    originalFileName: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["Pending", "Under Review", "Accepted", "Rejected"],
      default: "Pending",
    },
  },
  {
    timestamps: true,
  }
);

adminApplicantSchema.index({ email: 1 });
adminApplicantSchema.index({ status: 1 });
adminApplicantSchema.index({ createdAt: -1 });

module.exports = mongoose.model("AdminApplicant", adminApplicantSchema);
