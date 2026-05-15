import { DashboardLegend } from "@/core/domain/entities/DashboardUsageView";

interface DashboardFooterLegendProps {
  legend: DashboardLegend | null;
  refreshTimestamp: string | null;
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "Awaiting refresh";
  }

  return new Date(value).toLocaleString();
}

export function DashboardFooterLegend({ legend, refreshTimestamp }: DashboardFooterLegendProps) {
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