const { z } = require("zod");

const adminApplicantSchema = z
  .object({
    fullName: z
      .string({
        required_error: "Full name is required",
        invalid_type_error: "Full name must be a string",
      })
      .trim()
      .min(2, "Full name must be at least 2 characters")
      .max(100, "Full name cannot exceed 100 characters"),
    email: z
      .string({
        required_error: "Email is required",
        invalid_type_error: "Email must be a string",
      })
      .trim()
      .email("Invalid email address")
      .transform((val) => val.toLowerCase()),
    phone: z
      .string()
      .trim()
      .max(30, "Phone number is too long")
      .nullable()
      .optional()
      .or(z.literal("")),
    role: z
      .string()
      .trim()
      .max(100, "Role cannot exceed 100 characters")
      .nullable()
      .optional()
      .default("Moderator"),
    designation: z
      .string()
      .trim()
      .max(100, "Designation cannot exceed 100 characters")
      .nullable()
      .optional()
      .or(z.literal("")),
    experience: z
      .string()
      .trim()
      .max(2000, "Experience description too long")
      .nullable()
      .optional()
      .or(z.literal("")),
    message: z
      .string()
      .trim()
      .max(5000, "Message cannot exceed 5000 characters")
      .nullable()
      .optional()
      .or(z.literal("")),
    resumeUrl: z
      .string()
      .trim()
      .nullable()
      .optional()
      .or(z.literal("")),
    agreementUrl: z
      .string()
      .trim()
      .nullable()
      .optional()
      .or(z.literal("")),
  })
  .passthrough();

module.exports = {
  adminApplicantSchema,
};
