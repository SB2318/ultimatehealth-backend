const { z } = require("zod");

const getRelatedArticlesParamsSchema = z.object({
  id: z
    .string({
      error: "Article ID is required",
    })
    .regex(/^\d+$/, "Article ID must be a numeric integer"),
});

const getRelatedArticlesQuerySchema = z.object({
  limit: z
    .string()
    .regex(/^\d+$/, "Limit must be a positive integer")
    .optional()
    .transform((val) => (val ? Math.min(Math.max(parseInt(val, 10), 1), 20) : 5)),
  excludeIds: z
    .string()
    .optional(),
});

module.exports = {
  getRelatedArticlesParamsSchema,
  getRelatedArticlesQuerySchema,
};
