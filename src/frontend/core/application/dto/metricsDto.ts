import { z } from "zod";

export interface LatestMetricSnapshotResponseDto {
  snapshotId: string;
  applicationId: string;
  applicationName: string | null;
  runId: string;
  calculationDate: string;
  denominatorCount: number;
  numeratorCount: number;
  matchedCount: number;
  adoptionPct: number;
  denominatorRevenue: number | null;
  numeratorRevenue: number | null;
  revenuePct: number;
  onTarget: boolean;
  avgEngagement: number | null;
  metricDefinitionVersion: string;
  refreshTimestamp: string;
  sourceBatchId: string | null;
  filterRuleSnapshotId: string | null;
  syntheticInvestment: SyntheticInvestmentContextDto | null;
}

export interface SyntheticInvestmentContextDto {
  investmentId: string;
  calculationDate: string;
  investmentAmount: number;
  isSynthetic: true;
  nonAuthoritativeLabel: "NON_AUTHORITATIVE_SYNTHETIC";
  sourceBatchId: string | null;
}

export interface MetricHistoryResponseDto {
  applicationId: string;
  applicationName: string | null;
  totalCount: number;
  page: number;
  pageSize: number;
  snapshots: LatestMetricSnapshotResponseDto[];
}

export interface PipelineRunMetricsResponseDto {
  runId: string;
  applicationId: string;
  status: "Queued" | "Processing" | "Completed" | "Failed";
  startTime: string | null;
  endTime: string | null;
  matchedCount: number | null;
  snapshot: LatestMetricSnapshotResponseDto | null;
}

export const metricsAppPathSchema = z.object({
  appId: z.string().uuid()
});

export const metricsRunPathSchema = z.object({
  runId: z.string().uuid()
});

export const metricsHistoryQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  runId: z.string().uuid().optional()
});

export const metricsLatestQuerySchema = z.object({
  runId: z.string().uuid().optional(),
  includeSynthetic: z.coerce.boolean().optional().default(false)
});

export const metricSnapshotSchema = z.object({
  snapshotId: z.string().uuid(),
  applicationId: z.string().uuid(),
  applicationName: z.string().nullable(),
  runId: z.string().uuid(),
  calculationDate: z.string().datetime(),
  denominatorCount: z.number().int().nonnegative(),
  numeratorCount: z.number().int().nonnegative(),
  matchedCount: z.number().int().nonnegative(),
  adoptionPct: z.number().nonnegative(),
  denominatorRevenue: z.number().nullable(),
  numeratorRevenue: z.number().nullable(),
  revenuePct: z.number().nonnegative(),
  onTarget: z.boolean(),
  avgEngagement: z.number().nullable(),
  metricDefinitionVersion: z.string().min(1),
  refreshTimestamp: z.string().datetime(),
  sourceBatchId: z.string().nullable(),
  filterRuleSnapshotId: z.string().uuid().nullable(),
  syntheticInvestment: z.object({
    investmentId: z.string().uuid(),
    calculationDate: z.string().datetime(),
    investmentAmount: z.number(),
    isSynthetic: z.literal(true),
    nonAuthoritativeLabel: z.literal("NON_AUTHORITATIVE_SYNTHETIC"),
    sourceBatchId: z.string().nullable()
  }).nullable()
});
