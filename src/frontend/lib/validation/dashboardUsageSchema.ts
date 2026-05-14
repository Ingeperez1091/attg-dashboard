import { z } from "zod";

const nullableTrimmedString = z
  .string()
  .trim()
  .transform((value) => value.length === 0 ? undefined : value)
  .optional();

export const dashboardUsageQuerySchema = z.object({
  subServiceLine: nullableTrimmedString,
  runId: nullableTrimmedString.refine((value) => !value || z.string().uuid().safeParse(value).success, {
    message: "runId must be a valid UUID."
  })
});

export type DashboardUsageQueryInput = z.input<typeof dashboardUsageQuerySchema>;
export type DashboardUsageQuery = z.output<typeof dashboardUsageQuerySchema>;
