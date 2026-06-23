import { z } from "zod";

const uuidSchema = z.string().uuid();

export const previewRuleSchema = z.object({
  denominatorModelId: uuidSchema,
  operator: z.enum([
    "EQUALS",
    "NOT_EQUALS",
    "CONTAINS",
    "NOT_CONTAINS",
    "IN_LIST",
    "NOT_IN_LIST",
    "GREATER_THAN",
    "GREATER_OR_EQUAL",
    "LESS_THAN",
    "LESS_OR_EQUAL"
  ]),
  value: z.string().trim().min(1).max(512)
});

export const previewRequestSchema = z.object({
  rules: z.array(previewRuleSchema).min(1, "At least one rule is required")
});

export type PreviewRequestBody = z.infer<typeof previewRequestSchema>;
