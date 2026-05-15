import { z } from "zod";

const uuidSchema = z.string().uuid();

export const filterRuleInputSchema = z.object({
  applicationModelFieldId: uuidSchema,
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
}).superRefine((rule, ctx) => {
  if (rule.operator !== "IN_LIST" && rule.operator !== "NOT_IN_LIST") {
    return;
  }

  const parts = rule.value.split(";").map((item) => item.trim());
  const hasValidSemicolonSeparatedValues = parts.length >= 2 && parts.every((item) => item.length > 0);

  if (!hasValidSemicolonSeparatedValues) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["value"],
      message: "IN_LIST and NOT_IN_LIST values must be semicolon-separated (for example: value1;value2)."
    });
  }
});

export const updateNumeratorFiltersSchema = z.object({
  rules: z.array(filterRuleInputSchema)
});

export const numeratorModelFieldSchema = z.object({
  applicationModelFieldId: uuidSchema,
  fieldName: z.string().min(1),
  fieldType: z.enum(["text", "numeric", "boolean", "date"]),
  isFilterable: z.boolean(),
  isMetricDimension: z.boolean(),
  displayOrder: z.number().int().nonnegative()
});

export const errorEnvelopeSchema = z.object({
  error: z.string().min(1),
  message: z.string().min(1),
  details: z.record(z.string(), z.unknown()).optional()
});

export type FilterRuleInput = z.infer<typeof filterRuleInputSchema>;
export type UpdateNumeratorFiltersInput = z.infer<typeof updateNumeratorFiltersSchema>;
