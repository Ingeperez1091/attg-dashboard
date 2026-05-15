import { DashboardUsageResponseDto } from "@/core/application/dto/dashboardUsageDto";
import {
  DashboardGroupingResult,
  DashboardRunContext,
  DashboardScope,
  DashboardStateIndicator,
  DashboardUsageSnapshotRow
} from "@/core/domain/entities/DashboardUsageView";

function clampPct(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value * 100) / 100));
}

function toNullableAverage(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round((total / values.length) * 100) / 100;
}

function resolveInvestment(rows: DashboardUsageSnapshotRow[]): number | null {
  const total = rows.reduce((sum, row) => sum + (row.investmentAmount ?? 0), 0);
  return total > 0 ? total : null;
}

export function mapDashboardUsageResponse(input: {
  scope: DashboardScope;
  rows: DashboardUsageSnapshotRow[];
  grouping: DashboardGroupingResult;
  runContext: DashboardRunContext;
  state: DashboardStateIndicator;
}): DashboardUsageResponseDto {
  const authorizedApplicationIds = new Set(input.scope.applicationIds);
  const rows = input.rows.filter((row) => authorizedApplicationIds.has(row.applicationId));
  const groups = input.grouping.subServiceLineGroups
    .map((group) => ({
      ...group,
      metrics: {
        ...group.metrics,
        adoptionPct: clampPct(group.metrics.adoptionPct),
        revenuePct: clampPct(group.metrics.revenuePct)
      },
      children: group.children
        .filter((child) => authorizedApplicationIds.has(child.groupKey))
        .map((child) => ({
          ...child,
          metrics: {
            ...child.metrics,
            adoptionPct: clampPct(child.metrics.adoptionPct),
            revenuePct: clampPct(child.metrics.revenuePct)
          }
        }))
    }))
    .filter((group) => group.children.length > 0 || group.groupType !== "subServiceLine");

  const onTargetCount = rows.filter((row) => row.adoptionPct > 70).length;
  const onTargetRateValue = rows.length > 0
    ? Math.round((onTargetCount / rows.length) * 10000) / 100
    : null;

  const kpis = rows.length === 0
    ? null
    : {
        investment: {
          value: resolveInvestment(rows),
          label: "Investment",
          basis: null,
          isNonAuthoritative: true
        },
        revenue: {
          value: input.grouping.portfolioMetrics.numeratorRevenue,
          label: "Revenue",
          basis: "FYTD",
          isNonAuthoritative: false
        },
        averageEngagement: {
          value: toNullableAverage(rows.map((row) => row.adoptionPct)),
          label: "Avg. Engagement",
          basis: null,
          isNonAuthoritative: false
        },
        onTargetRate: {
          value: onTargetRateValue,
          label: "On Target",
          basis: "adoption-threshold",
          isNonAuthoritative: false
        },
        refreshTimestamp: input.grouping.refreshTimestamp ?? new Date(0).toISOString()
      };

  return {
    scope: input.scope,
    hero: {
      title: "Application Usage Dashboard",
      latestRunId: input.runContext.latestCompletedRunId ?? input.grouping.latestRunId,
      refreshTimestamp: input.grouping.refreshTimestamp
    },
    kpis,
    groups,
    state: input.state,
    legend: {
      metricDefinitionVersion: input.grouping.metricDefinitionVersion
    }
  };
}

export function mapDashboardUsageErrorResponse(input: {
  scope: DashboardScope;
  message?: string;
}): DashboardUsageResponseDto {
  return {
    scope: input.scope,
    hero: {
      title: "Application Usage Dashboard",
      latestRunId: null,
      refreshTimestamp: null
    },
    kpis: null,
    groups: [],
    state: {
      state: "error",
      message: input.message ?? "Dashboard data is temporarily unavailable.",
      lastSuccessfulRunId: null,
      isRecalculating: false
    },
    legend: {
      metricDefinitionVersion: null
    }
  };
}
