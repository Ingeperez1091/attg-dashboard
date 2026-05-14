import {
  MetricHistoryPage,
  MetricHistoryQuery,
  MetricSnapshot,
  PipelineRunMetricsSummary,
  SyntheticInvestmentFact
} from "@/core/domain/entities/MetricSnapshot";

export interface IMetricsRepository {
  getLatestSnapshot(applicationId: string, runId?: string): Promise<MetricSnapshot | null>;
  listSnapshotHistory(query: MetricHistoryQuery): Promise<MetricHistoryPage>;
  getRunMetricsSummary(runId: string): Promise<PipelineRunMetricsSummary | null>;
  listSyntheticInvestmentFacts(applicationId: string): Promise<SyntheticInvestmentFact[]>;
}
