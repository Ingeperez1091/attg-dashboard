import { z } from "zod";

const uuidSchema = z.string().uuid();

export const denominatorRuleInputSchema = z.object({
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
}).superRefine((rule, ctx) => {
  if (rule.operator !== "IN_LIST" && rule.operator !== "NOT_IN_LIST") {
    return;
  }

  const parts = rule.value.split(";").map((item) => item.trim());
  const isSemicolonSeparated = parts.length >= 2 && parts.every((item) => item.length > 0);

  if (!isSemicolonSeparated) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["value"],
      message: "IN_LIST and NOT_IN_LIST values must be semicolon-separated (for example: value1;value2)."
    });
  }
});

export const updateDenominatorFiltersSchema = z.object({
  rules: z.array(denominatorRuleInputSchema)
});

export const adoptionSettingsUpdateSchema = z.object({
  adoptionLevel: z.enum(["Engagement", "Client"]),
  revenueMetric: z.string().min(1).max(64),
  numeratorSource: z.enum(["API", "Manual"])
});

export type DenominatorRuleInput = z.infer<typeof denominatorRuleInputSchema>;
export type UpdateDenominatorFiltersSchema = z.infer<typeof updateDenominatorFiltersSchema>;
export type AdoptionSettingsUpdateSchema = z.infer<typeof adoptionSettingsUpdateSchema>;
