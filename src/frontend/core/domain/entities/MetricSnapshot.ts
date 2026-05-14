export interface MetricSnapshot {
  snapshotId: string;
  runId: string;
  applicationId: string;
  applicationName: string | null;
  calculationDate: string;
  denominatorCount: number;
  numeratorCount: number;
  matchedCount: number;
  adoptionPct: number;
  denominatorRevenue: number | null;
  numeratorRevenue: number | null;
  revenuePct: number;
  avgEngagement: number | null;
  metricDefinitionVersion: string;
  refreshTimestamp: string;
  sourceBatchId: string | null;
  filterRuleSnapshotId: string | null;
}

export interface SyntheticInvestmentFact {
  investmentId: string;
  applicationId: string;
  calculationDate: string;
  investmentAmount: number;
  isSynthetic: boolean;
  syntheticBusinessKey: string;
  sourceBatchId: string | null;
}

export interface MetricHistoryQuery {
  applicationId: string;
  runId?: string | null;
  from: string | null;
  to: string | null;
  page: number;
  pageSize: number;
}

export interface MetricHistoryPage {
  items: MetricSnapshot[];
  total: number;
  page: number;
  pageSize: number;
}

export type PipelineRunMetricsStatus = "Queued" | "Processing" | "Completed" | "Failed";

export interface PipelineRunMetricsSummary {
  runId: string;
  applicationId: string;
  status: PipelineRunMetricsStatus;
  startTime: string | null;
  endTime: string | null;
  matchedCount: number | null;
  snapshot: MetricSnapshot | null;
}
