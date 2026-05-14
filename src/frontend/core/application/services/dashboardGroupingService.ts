import {
  DashboardGroup,
  DashboardGroupMetricSummary,
  DashboardGroupingResult,
  DashboardUsageSnapshotRow
} from "@/core/domain/entities/DashboardUsageView";

export const FALLBACK_SUB_SERVICE_LINE = "Unassigned";

export function toDashboardSubServiceLineLabel(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : FALLBACK_SUB_SERVICE_LINE;
}

export function normalizeDashboardSubServiceLineKey(value: string | null | undefined): string {
  return toDashboardSubServiceLineLabel(value).toLowerCase();
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function calculatePct(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  return round2((numerator / denominator) * 100);
}

function toStatus(adoptionPct: number): DashboardGroupMetricSummary["status"] {
  if (!Number.isFinite(adoptionPct)) {
    return "Unknown";
  }

  return adoptionPct > 70 ? "On Target" : "Below Target";
}

function summarizeRows(rows: DashboardUsageSnapshotRow[]): DashboardGroupMetricSummary {
  const denominatorCount = rows.reduce((sum, row) => sum + row.denominatorCount, 0);
  const numeratorCount = rows.reduce((sum, row) => sum + row.numeratorCount, 0);
  const matchedCount = rows.reduce((sum, row) => sum + row.matchedCount, 0);
  const denominatorRevenue = rows.reduce((sum, row) => sum + (row.denominatorRevenue ?? 0), 0);
  const numeratorRevenue = rows.reduce((sum, row) => sum + (row.numeratorRevenue ?? 0), 0);
  const investmentAmount = rows.reduce((sum, row) => sum + (row.investmentAmount ?? 0), 0);

  const adoptionPct = calculatePct(numeratorCount, denominatorCount);
  const revenuePct = calculatePct(numeratorRevenue, denominatorRevenue);
  const averageEngagement = rows.length > 0
    ? round2(rows.reduce((sum, row) => sum + row.adoptionPct, 0) / rows.length)
    : null;

  return {
    denominatorCount,
    numeratorCount,
    matchedCount,
    adoptionPct,
    revenuePct,
    denominatorRevenue,
    numeratorRevenue,
    averageEngagement,
    investmentAmount: investmentAmount > 0 ? investmentAmount : null,
    status: toStatus(adoptionPct)
  };
}

export function aggregateDashboardGroups(rows: DashboardUsageSnapshotRow[]): DashboardGroupingResult {
  if (rows.length === 0) {
    return {
      portfolioMetrics: summarizeRows([]),
      subServiceLineGroups: [],
      refreshTimestamp: null,
      metricDefinitionVersion: null,
      latestRunId: null
    };
  }

  const bySubServiceLine = new Map<string, DashboardUsageSnapshotRow[]>();
  for (const row of rows) {
    const key = toDashboardSubServiceLineLabel(row.subServiceLine);
    const existing = bySubServiceLine.get(key);
    if (existing) {
      existing.push(row);
    } else {
      bySubServiceLine.set(key, [row]);
    }
  }

  const subServiceLineGroups: DashboardGroup[] = Array.from(bySubServiceLine.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([subServiceLine, subRows]) => {
      const children: DashboardGroup[] = subRows
        .sort((left, right) => left.applicationName.localeCompare(right.applicationName))
        .map((row) => ({
          groupType: "application",
          groupKey: row.applicationId,
          displayName: row.applicationName,
          subServiceLine: row.subServiceLine?.trim() || null,
          metrics: {
            denominatorCount: row.denominatorCount,
            numeratorCount: row.numeratorCount,
            matchedCount: row.matchedCount,
            adoptionPct: row.adoptionPct,
            revenuePct: row.revenuePct,
            denominatorRevenue: row.denominatorRevenue,
            numeratorRevenue: row.numeratorRevenue,
            averageEngagement: row.avgEngagement,
            investmentAmount: row.investmentAmount,
            status: toStatus(row.adoptionPct)
          },
          children: []
        }));

      return {
        groupType: "subServiceLine",
        groupKey: subServiceLine,
        displayName: subServiceLine,
        subServiceLine: subServiceLine === FALLBACK_SUB_SERVICE_LINE ? null : subServiceLine,
        metrics: summarizeRows(subRows),
        children
      };
    });

  const latestByCalculationDate = [...rows].sort(
    (left, right) => new Date(right.calculationDate).getTime() - new Date(left.calculationDate).getTime()
  )[0];

  return {
    portfolioMetrics: summarizeRows(rows),
    subServiceLineGroups,
    refreshTimestamp: latestByCalculationDate?.refreshTimestamp ?? null,
    metricDefinitionVersion: latestByCalculationDate?.metricDefinitionVersion ?? null,
    latestRunId: latestByCalculationDate?.runId ?? null
  };
}
