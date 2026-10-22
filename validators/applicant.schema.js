const { z } = require("zod");

const adminApplicantSchema = z.object({
  fullName: z
    .string({
      error: "Full name is required",
    })
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name cannot exceed 100 characters"),
  email: z
    .string({
      error: "Email is required",
    })
    .trim()
    .email("Invalid email address")
    .transform((val) => val.toLowerCase()),
  phone: z
    .string()
    .trim()
    .max(25, "Phone number is too long")
    .optional()
    .or(z.literal("")),
  role: z
    .enum(["Moderator", "Content Reviewer", "Admin", "Doctor/Medical Reviewer", "Other"])
    .default("Moderator")
    .optional(),
  experience: z
    .string()
    .trim()
    .max(1000, "Experience description too long")
    .optional()
    .or(z.literal("")),
  message: z
    .string()
    .trim()
    .max(3000, "Message cannot exceed 3000 characters")
    .optional()
    .or(z.literal("")),
  resumeUrl: z
    .string()
    .trim()
    .url("Invalid resume URL")
    .optional()
    .or(z.literal("")),
});

module.exports = {
  adminApplicantSchema,
};
