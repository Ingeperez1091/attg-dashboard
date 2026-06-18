import { DashboardLegend } from "@/core/domain/entities/DashboardUsageView";

interface DashboardFooterLegendProps {
  legend: DashboardLegend | null;
  refreshTimestamp: string | null;
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "Awaiting refresh";
  }

  // Database stores UTC (SYSUTCDATETIME); ensure parsing treats it as UTC
  const utcValue = value.endsWith("Z") || value.includes("+") ? value : value + "Z";
  return new Date(utcValue).toLocaleString();
}

export function DashboardFooterLegend({ legend, refreshTimestamp }: Readonly<DashboardFooterLegendProps>) {
  return (
    <footer className="dashboard-footer-legend">
      <span>ETD = Engagement to date</span>
      <span aria-hidden="true">•</span>
      <span>FYTD = Fiscal year to date</span>
      <span aria-hidden="true">•</span>
      <span>Metric definition: {legend?.metricDefinitionVersion ?? "Unavailable"}</span>
      <span aria-hidden="true">•</span>
      <span>Refreshed: {formatTimestamp(refreshTimestamp)}</span>
    </footer>
  );
}