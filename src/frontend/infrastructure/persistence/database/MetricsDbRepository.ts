import {
  MetricHistoryPage,
  MetricHistoryQuery,
  MetricSnapshot,
  PipelineRunMetricsSummary,
  SyntheticInvestmentFact
} from "@/core/domain/entities/MetricSnapshot";
import { IMetricsRepository } from "@/core/domain/repositories/metricsRepository";
import { executeParameterizedQuery, SqlClient } from "@/lib/db/sql-client";

type MetricSnapshotRow = {
  SnapshotId: string;
  RunId: string;
  ApplicationId: string;
  ApplicationName: string | null;
  CalculationDate: string;
  DenominatorCount: number;
  NumeratorCount: number;
  MatchedCount: number;
  AdoptionPct: number;
  DenominatorRevenue: number | null;
  NumeratorRevenue: number | null;
  RevenuePct: number;
  AvgEngagement: number | null;
  MetricDefinitionVersion: string;
  RefreshTimestamp: string;
  SourceBatchId: string | null;
  FilterRuleSnapshotId: string | null;
};

type RunMetricsSummaryRow = {
  RunId: string;
  ApplicationId: string;
  Status: "Queued" | "Processing" | "Completed" | "Failed";
  StartTime: string | null;
  EndTime: string | null;
  MatchedCount: number | null;
  SnapshotId: string | null;
  CalculationDate: string | null;
  DenominatorCount: number | null;
  NumeratorCount: number | null;
  AdoptionPct: number | null;
  DenominatorRevenue: number | null;
  NumeratorRevenue: number | null;
  RevenuePct: number | null;
  AvgEngagement: number | null;
  MetricDefinitionVersion: string | null;
  RefreshTimestamp: string | null;
  SourceBatchId: string | null;
  FilterRuleSnapshotId: string | null;
};

type SyntheticInvestmentFactRow = {
  InvestmentId: string;
  ApplicationId: string;
  CalculationDate: string;
  InvestmentAmount: number;
  IsSynthetic: boolean;
  SyntheticBusinessKey: string;
  SourceBatchId: string | null;
};

function toNumber(value: number | string | null): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  return 0;
}

function mapSnapshotRow(row: MetricSnapshotRow): MetricSnapshot {
  return {
    snapshotId: row.SnapshotId,
    runId: row.RunId,
    applicationId: row.ApplicationId,
    applicationName: row.ApplicationName,
    calculationDate: row.CalculationDate,
    denominatorCount: toNumber(row.DenominatorCount),
    numeratorCount: toNumber(row.NumeratorCount),
    matchedCount: toNumber(row.MatchedCount),
    adoptionPct: toNumber(row.AdoptionPct),
    denominatorRevenue: row.DenominatorRevenue == null ? null : toNumber(row.DenominatorRevenue),
    numeratorRevenue: row.NumeratorRevenue == null ? null : toNumber(row.NumeratorRevenue),
    revenuePct: toNumber(row.RevenuePct),
    avgEngagement: row.AvgEngagement == null ? null : toNumber(row.AvgEngagement),
    metricDefinitionVersion: row.MetricDefinitionVersion,
    refreshTimestamp: row.RefreshTimestamp,
    sourceBatchId: row.SourceBatchId,
    filterRuleSnapshotId: row.FilterRuleSnapshotId
  };
}

function mapSyntheticInvestmentRow(row: SyntheticInvestmentFactRow): SyntheticInvestmentFact {
  return {
    investmentId: row.InvestmentId,
    applicationId: row.ApplicationId,
    calculationDate: row.CalculationDate,
    investmentAmount: toNumber(row.InvestmentAmount),
    isSynthetic: Boolean(row.IsSynthetic),
    syntheticBusinessKey: row.SyntheticBusinessKey,
    sourceBatchId: row.SourceBatchId
  };
}

export class MetricsDbRepository implements IMetricsRepository {
  constructor(private readonly sqlClient: SqlClient) {}

  async getLatestSnapshot(applicationId: string, runId?: string): Promise<MetricSnapshot | null> {
    const result = await executeParameterizedQuery<MetricSnapshotRow>(
      this.sqlClient,
      `
        SELECT TOP 1
          ms.SnapshotId,
          ms.RunId,
          ms.ApplicationId,
          a.ApplicationName AS ApplicationName,
          ms.CalculationDate,
          ms.DenominatorCount,
          ms.NumeratorCount,
          ms.MatchedCount,
          ms.AdoptionPct,
          ms.DenominatorRevenue,
          ms.NumeratorRevenue,
          ms.RevenuePct,
          ms.AvgEngagement,
          ms.MetricDefinitionVersion,
          ms.RefreshTimestamp,
          ms.SourceBatchId,
          ms.FilterRuleSnapshotId
        FROM app.MetricSnapshots ms
        INNER JOIN app.Applications a ON a.ApplicationId = ms.ApplicationId
        WHERE ms.ApplicationId = @applicationId
          AND (@runId IS NULL OR ms.RunId = @runId)
        ORDER BY ms.CalculationDate DESC, ms.CreateDate DESC;
      `,
      {
        applicationId,
        runId: runId ?? null
      }
    );

    const row = result.rows[0];
    return row ? mapSnapshotRow(row) : null;
  }

  async listSnapshotHistory(query: MetricHistoryQuery): Promise<MetricHistoryPage> {
    const offset = (query.page - 1) * query.pageSize;

    const totalResult = await executeParameterizedQuery<{ TotalCount: number }>(
      this.sqlClient,
      `
        SELECT COUNT(1) AS TotalCount
        FROM app.MetricSnapshots ms
        WHERE ms.ApplicationId = @applicationId
          AND (@runId IS NULL OR ms.RunId = @runId)
          AND (@fromDate IS NULL OR ms.CalculationDate >= @fromDate)
          AND (@toDate IS NULL OR ms.CalculationDate <= @toDate);
      `,
      {
        applicationId: query.applicationId,
        runId: query.runId ?? null,
        fromDate: query.from,
        toDate: query.to
      }
    );

    const rowsResult = await executeParameterizedQuery<MetricSnapshotRow>(
      this.sqlClient,
      `
        SELECT
          ms.SnapshotId,
          ms.RunId,
          ms.ApplicationId,
          a.ApplicationName AS ApplicationName,
          ms.CalculationDate,
          ms.DenominatorCount,
          ms.NumeratorCount,
          ms.MatchedCount,
          ms.AdoptionPct,
          ms.DenominatorRevenue,
          ms.NumeratorRevenue,
          ms.RevenuePct,
          ms.AvgEngagement,
          ms.MetricDefinitionVersion,
          ms.RefreshTimestamp,
          ms.SourceBatchId,
          ms.FilterRuleSnapshotId
        FROM app.MetricSnapshots ms
        INNER JOIN app.Applications a ON a.ApplicationId = ms.ApplicationId
        WHERE ms.ApplicationId = @applicationId
          AND (@runId IS NULL OR ms.RunId = @runId)
          AND (@fromDate IS NULL OR ms.CalculationDate >= @fromDate)
          AND (@toDate IS NULL OR ms.CalculationDate <= @toDate)
        ORDER BY ms.CalculationDate DESC, ms.CreateDate DESC
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;
      `,
      {
        applicationId: query.applicationId,
        runId: query.runId ?? null,
        fromDate: query.from,
        toDate: query.to,
        offset,
        pageSize: query.pageSize
      }
    );

    return {
      items: rowsResult.rows.map(mapSnapshotRow),
      total: totalResult.rows[0]?.TotalCount ?? 0,
      page: query.page,
      pageSize: query.pageSize
    };
  }

  async getRunMetricsSummary(runId: string): Promise<PipelineRunMetricsSummary | null> {
    const result = await executeParameterizedQuery<RunMetricsSummaryRow>(
      this.sqlClient,
      `
        SELECT TOP 1
          pr.RunId,
          pr.ApplicationId,
          pr.Status,
          pr.StartTime,
          pr.EndTime,
          pr.MatchedCount,
          ms.SnapshotId,
          ms.CalculationDate,
          ms.DenominatorCount,
          ms.NumeratorCount,
          ms.AdoptionPct,
          ms.DenominatorRevenue,
          ms.NumeratorRevenue,
          ms.RevenuePct,
          ms.AvgEngagement,
          ms.MetricDefinitionVersion,
          ms.RefreshTimestamp,
          ms.SourceBatchId,
          ms.FilterRuleSnapshotId
        FROM app.PipelineRuns pr
        LEFT JOIN app.MetricSnapshots ms ON ms.RunId = pr.RunId
        WHERE pr.RunId = @runId
        ORDER BY ms.CalculationDate DESC, ms.CreateDate DESC;
      `,
      { runId }
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      runId: row.RunId,
      applicationId: row.ApplicationId,
      status: row.Status,
      startTime: row.StartTime,
      endTime: row.EndTime,
      matchedCount: row.MatchedCount,
      snapshot: row.SnapshotId
        ? {
            snapshotId: row.SnapshotId,
            runId: row.RunId,
            applicationId: row.ApplicationId,
            applicationName: null,
            calculationDate: row.CalculationDate ?? new Date(0).toISOString(),
            denominatorCount: toNumber(row.DenominatorCount),
            numeratorCount: toNumber(row.NumeratorCount),
            matchedCount: toNumber(row.MatchedCount),
            adoptionPct: toNumber(row.AdoptionPct),
            denominatorRevenue: row.DenominatorRevenue == null ? null : toNumber(row.DenominatorRevenue),
            numeratorRevenue: row.NumeratorRevenue == null ? null : toNumber(row.NumeratorRevenue),
            revenuePct: toNumber(row.RevenuePct),
            avgEngagement: row.AvgEngagement == null ? null : toNumber(row.AvgEngagement),
            metricDefinitionVersion: row.MetricDefinitionVersion ?? "EPIC-007-v1",
            refreshTimestamp: row.RefreshTimestamp ?? new Date(0).toISOString(),
            sourceBatchId: row.SourceBatchId,
            filterRuleSnapshotId: row.FilterRuleSnapshotId
          }
        : null
    };
  }

  async listSyntheticInvestmentFacts(applicationId: string): Promise<SyntheticInvestmentFact[]> {
    const result = await executeParameterizedQuery<SyntheticInvestmentFactRow>(
      this.sqlClient,
      `
        SELECT
          InvestmentId,
          ApplicationId,
          CAST(CalculationDate AS DATETIME2) AS CalculationDate,
          InvestmentAmount,
          IsSynthetic,
          SyntheticBusinessKey,
          SourceBatchId
        FROM app.InvestmentDummyFacts
        WHERE ApplicationId = @applicationId
          AND IsSynthetic = 1
        ORDER BY CalculationDate DESC, CreateDate DESC;
      `,
      { applicationId }
    );

    return result.rows.map(mapSyntheticInvestmentRow);
  }
}
