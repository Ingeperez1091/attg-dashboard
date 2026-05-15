export type DashboardRole = "administrator" | "application_owner" | "viewer";

export interface DashboardScope {
  userId: string;
  role: DashboardRole;
  applicationIds: string[];
  selectedSubServiceLine: string | null;
}

export interface DashboardMetricCardValue {
  value: number | null;
  label: string;
  basis: string | null;
  isNonAuthoritative: boolean;
}

export interface DashboardKpiCardSet {
  investment: DashboardMetricCardValue;
  revenue: DashboardMetricCardValue;
  averageEngagement: DashboardMetricCardValue;
  onTargetRate: DashboardMetricCardValue;
  refreshTimestamp: string;
}

export type DashboardGroupType = "portfolio" | "subServiceLine" | "application";

export interface DashboardGroupMetricSummary {
  denominatorCount: number;
  numeratorCount: number;
  matchedCount: number;
  adoptionPct: number;
  revenuePct: number;
  denominatorRevenue: number | null;
  numeratorRevenue: number | null;
  averageEngagement: number | null;
  investmentAmount: number | null;
  status: "On Target" | "Below Target" | "Unknown";
}

export interface DashboardGroup {
  groupType: DashboardGroupType;
  groupKey: string;
  displayName: string;
  subServiceLine: string | null;
  metrics: DashboardGroupMetricSummary;
  children: DashboardGroup[];
}

export interface DashboardUsageSnapshotRow {
  snapshotId: string;
  runId: string;
  applicationId: string;
  applicationName: string;
  subServiceLine: string | null;
  calculationDate: string;
  refreshTimestamp: string;
  metricDefinitionVersion: string;
  denominatorCount: number;
  numeratorCount: number;
  matchedCount: number;
  adoptionPct: number;
  denominatorRevenue: number | null;
  numeratorRevenue: number | null;
  revenuePct: number;
  avgEngagement: number | null;
  investmentAmount: number | null;
}

export interface DashboardRunContext {
  latestCompletedRunId: string | null;
  activeRun: {
    runId: string;
    applicationId: string;
    status: "Queued" | "Processing";
    startTime: string | null;
  } | null;
}

export type DashboardStateName = "ready" | "empty" | "inProgress" | "error";

export interface DashboardStateIndicator {
  state: DashboardStateName;
  message: string;
  lastSuccessfulRunId: string | null;
  isRecalculating: boolean;
}

export interface DashboardHero {
  title: string;
  latestRunId: string | null;
  refreshTimestamp: string | null;
}

export interface DashboardLegend {
  metricDefinitionVersion: string | null;
}

export interface DashboardGroupingResult {
  portfolioMetrics: DashboardGroupMetricSummary;
  subServiceLineGroups: DashboardGroup[];
  refreshTimestamp: string | null;
  metricDefinitionVersion: string | null;
  latestRunId: string | null;
}

export interface DashboardUsageView {
  scope: DashboardScope;
  hero: DashboardHero;
  kpis: DashboardKpiCardSet | null;
  groups: DashboardGroup[];
  state: DashboardStateIndicator;
  legend: DashboardLegend;
}
