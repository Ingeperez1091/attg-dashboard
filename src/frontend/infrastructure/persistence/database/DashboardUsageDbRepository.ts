import {
  DashboardRunContext,
  DashboardUsageSnapshotRow
} from "@/core/domain/entities/DashboardUsageView";
import { DashboardUsageRepository } from "@/core/domain/repositories/dashboardUsageRepository";
import { executeParameterizedQuery, SqlClient } from "@/lib/db/sql-client";

type DashboardUsageRow = {
  SnapshotId: string;
  RunId: string;
  ApplicationId: string;
  ApplicationName: string;
  SubServiceLine: string | null;
  CalculationDate: string;
  RefreshTimestamp: string;
  MetricDefinitionVersion: string;
  DenominatorCount: number;
  NumeratorCount: number;
  MatchedCount: number;
  AdoptionPct: number;
  DenominatorRevenue: number | null;
  NumeratorRevenue: number | null;
  RevenuePct: number;
  AvgEngagement: number | null;
  InvestmentAmount: number | null;
};

type DashboardRunContextRow = {
  LatestCompletedRunId: string | null;
  ActiveRunId: string | null;
  ActiveRunApplicationId: string | null;
  ActiveRunStatus: "Queued" | "Processing" | null;
  ActiveRunStartTime: string | null;
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

function toNullableNumber(value: number | string | null): number | null {
  if (value === null || typeof value === "undefined") {
    return null;
  }

  return toNumber(value);
}

function mapUsageRow(row: DashboardUsageRow): DashboardUsageSnapshotRow {
  return {
    snapshotId: row.SnapshotId,
    runId: row.RunId,
    applicationId: row.ApplicationId,
    applicationName: row.ApplicationName,
    subServiceLine: row.SubServiceLine,
    calculationDate: row.CalculationDate,
    refreshTimestamp: row.RefreshTimestamp,
    metricDefinitionVersion: row.MetricDefinitionVersion,
    denominatorCount: toNumber(row.DenominatorCount),
    numeratorCount: toNumber(row.NumeratorCount),
    matchedCount: toNumber(row.MatchedCount),
    adoptionPct: toNumber(row.AdoptionPct),
    denominatorRevenue: toNullableNumber(row.DenominatorRevenue),
    numeratorRevenue: toNullableNumber(row.NumeratorRevenue),
    revenuePct: toNumber(row.RevenuePct),
    avgEngagement: toNullableNumber(row.AvgEngagement),
    investmentAmount: toNullableNumber(row.InvestmentAmount)
  };
}

export class DashboardUsageDbRepository implements DashboardUsageRepository {
  constructor(private readonly sqlClient: SqlClient) {}

  async listUsageRows(input: { applicationIds: string[]; runId?: string }): Promise<DashboardUsageSnapshotRow[]> {
    if (input.applicationIds.length === 0) {
      return [];
    }

    const applicationIdsCsv = input.applicationIds.join(",");
    const result = await executeParameterizedQuery<DashboardUsageRow>(
      this.sqlClient,
      `
      WITH ScopedSnapshots AS (
        SELECT
          ms.SnapshotId,
          ms.RunId,
          ms.ApplicationId,
          app.ApplicationName,
          app.SubServiceLine,
          ms.CalculationDate,
          ms.RefreshTimestamp,
          ms.MetricDefinitionVersion,
          ms.DenominatorCount,
          ms.NumeratorCount,
          ms.MatchedCount,
          ms.AdoptionPct,
          ms.DenominatorRevenue,
          ms.NumeratorRevenue,
          ms.RevenuePct,
          ms.AvgEngagement,
          ROW_NUMBER() OVER (
            PARTITION BY ms.ApplicationId
            ORDER BY ms.CalculationDate DESC, ms.CreateDate DESC
          ) AS rn
        FROM app.MetricSnapshots ms
        INNER JOIN app.Applications app ON app.ApplicationId = ms.ApplicationId
        WHERE CAST(ms.ApplicationId AS NVARCHAR(36)) IN (
          SELECT TRIM(value) FROM STRING_SPLIT(@applicationIdsCsv, ',')
        )
          AND (@runId IS NULL OR ms.RunId = @runId)
      ),
      LatestInvestment AS (
        SELECT
          i.ApplicationId,
          i.InvestmentAmount,
          ROW_NUMBER() OVER (
            PARTITION BY i.ApplicationId
            ORDER BY i.CalculationDate DESC, i.CreateDate DESC
          ) AS rn
        FROM app.InvestmentDummyFacts i
        WHERE i.IsSynthetic = 1
      )
      SELECT
        s.SnapshotId,
        s.RunId,
        s.ApplicationId,
        s.ApplicationName,
        s.SubServiceLine,
        CAST(s.CalculationDate AS NVARCHAR(33)) AS CalculationDate,
        CAST(s.RefreshTimestamp AS NVARCHAR(33)) AS RefreshTimestamp,
        s.MetricDefinitionVersion,
        s.DenominatorCount,
        s.NumeratorCount,
        s.MatchedCount,
        s.AdoptionPct,
        s.DenominatorRevenue,
        s.NumeratorRevenue,
        s.RevenuePct,
        s.AvgEngagement,
        inv.InvestmentAmount
      FROM ScopedSnapshots s
      LEFT JOIN LatestInvestment inv
        ON inv.ApplicationId = s.ApplicationId
       AND inv.rn = 1
      WHERE (@runId IS NOT NULL OR s.rn = 1)
      ORDER BY s.SubServiceLine, s.ApplicationName;
      `,
      {
        applicationIdsCsv,
        runId: input.runId ?? null
      }
    );

    return result.rows.map(mapUsageRow);
  }

  async getRunContext(input: { applicationIds: string[] }): Promise<DashboardRunContext> {
    if (input.applicationIds.length === 0) {
      return {
        latestCompletedRunId: null,
        activeRun: null
      };
    }

    const applicationIdsCsv = input.applicationIds.join(",");
    const result = await executeParameterizedQuery<DashboardRunContextRow>(
      this.sqlClient,
      `
      WITH ScopedRuns AS (
        SELECT
          pr.RunId,
          pr.ApplicationId,
          pr.Status,
          pr.StartTime,
          pr.CreateDate
        FROM app.PipelineRuns pr
        WHERE CAST(pr.ApplicationId AS NVARCHAR(36)) IN (
          SELECT TRIM(value) FROM STRING_SPLIT(@applicationIdsCsv, ',')
        )
      ),
      LatestCompleted AS (
        SELECT TOP 1 RunId
        FROM ScopedRuns
        WHERE Status = 'Completed'
        ORDER BY CreateDate DESC
      ),
      ActiveRun AS (
        SELECT TOP 1
          RunId,
          ApplicationId,
          Status,
          StartTime
        FROM ScopedRuns
        WHERE Status IN ('Queued', 'Processing')
        ORDER BY CreateDate DESC
      )
      SELECT
        (SELECT TOP 1 RunId FROM LatestCompleted) AS LatestCompletedRunId,
        (SELECT TOP 1 RunId FROM ActiveRun) AS ActiveRunId,
        (SELECT TOP 1 ApplicationId FROM ActiveRun) AS ActiveRunApplicationId,
        (SELECT TOP 1 Status FROM ActiveRun) AS ActiveRunStatus,
        (SELECT TOP 1 CAST(StartTime AS NVARCHAR(33)) FROM ActiveRun) AS ActiveRunStartTime;
      `,
      { applicationIdsCsv }
    );

    const row = result.rows[0];
    if (!row || !row.ActiveRunId || !row.ActiveRunApplicationId || !row.ActiveRunStatus) {
      return {
        latestCompletedRunId: row?.LatestCompletedRunId ?? null,
        activeRun: null
      };
    }

    return {
      latestCompletedRunId: row.LatestCompletedRunId,
      activeRun: {
        runId: row.ActiveRunId,
        applicationId: row.ActiveRunApplicationId,
        status: row.ActiveRunStatus,
        startTime: row.ActiveRunStartTime
      }
    };
  }
}
