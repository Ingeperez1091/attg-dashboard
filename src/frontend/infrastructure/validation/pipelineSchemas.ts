import { z } from "zod";

const uuidSchema = z.string().uuid();

export const triggerPipelineRequestSchema = z.object({
  applicationId: uuidSchema,
  triggerSource: z.enum(["API", "ADF", "Manual"]).default("API")
});

export const pipelineRunStatusSchema = z.enum(["Queued", "Processing", "Completed", "Failed"]);

export const triggerPipelineResponseSchema = z.object({
  runId: uuidSchema,
  applicationId: uuidSchema,
  status: pipelineRunStatusSchema,
  executionMode: z.enum(["adf", "local"])
});

export const validationResultsQuerySchema = z.object({
  runId: uuidSchema.optional(),
  status: z.enum(["Valid", "Invalid", "Duplicate", "FilteredOut"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50)
});

export type TriggerPipelineRequest = z.infer<typeof triggerPipelineRequestSchema>;
export type TriggerPipelineResponse = z.infer<typeof triggerPipelineResponseSchema>;
export type ValidationResultsQuery = z.infer<typeof validationResultsQuerySchema>;
