import { z } from "zod";

const jsonPrimitive = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

const jsonValue: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([jsonPrimitive, z.array(jsonValue), z.record(jsonValue)])
);

const payloadSchema = z.union([z.record(jsonValue), z.array(jsonValue)]);

export const numeratorIngestionRequestSchema = z.object({
  applicationId: z.string().uuid("Invalid ApplicationId"),
  payload: payloadSchema
});

export type NumeratorIngestionRequest = z.infer<typeof numeratorIngestionRequestSchema>;
