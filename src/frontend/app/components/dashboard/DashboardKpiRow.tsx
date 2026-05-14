import { DashboardKpiCardSet } from "@/core/domain/entities/DashboardUsageView";

interface DashboardKpiRowProps {
  kpis: DashboardKpiCardSet | null;
  loading?: boolean;
}

function formatCompactCurrency(value: number | null): string {
  if (value === null) {
    return "--";
  }

  if (value >= 1000000) {
    return `$${Math.round((value / 1000000) * 10) / 10}M`;
  }

  if (value >= 1000) {
    return `$${Math.round((value / 1000) * 10) / 10}K`;
  }

  return `$${Math.round(value)}`;
}

function formatPercent(value: number | null): string {
  if (value === null) {
    return "--";
  }

  return `${Math.round(value)}%`;
}

function KpiCard({
  label,
  value,
  helper,
  tone
}: {
  label: string;
  value: string;
  helper?: string;
  tone: "violet" | "amber" | "cyan" | "orange";
}) {
  return (
    <article className={`dashboard-kpi dashboard-kpi--${tone}`}>
      <span className="dashboard-kpi__label">{label}</span>
      <strong className="dashboard-kpi__value">{value}</strong>
      {helper ? <span className="dashboard-kpi__helper">{helper}</span> : <span className="dashboard-kpi__helper">&nbsp;</span>}
    </article>
  );
}

export function DashboardKpiRow({ kpis, loading = false }: DashboardKpiRowProps) {
  return (
    <section className="dashboard-kpi-row" aria-label="Portfolio KPI summary">
      <KpiCard
        label="Investment"
        value={loading ? "Loading..." : formatCompactCurrency(kpis?.investment.value ?? null)}
        helper={kpis?.investment.isNonAuthoritative ? "Non-authoritative interim value" : undefined}
        tone="violet"
      />
      <KpiCard
        label="Revenue"
        value={loading ? "Loading..." : formatCompactCurrency(kpis?.revenue.value ?? null)}
        helper={kpis?.revenue.basis ?? undefined}
        tone="amber"
      />
      <KpiCard
        label="Avg. Engagement"
        value={loading ? "Loading..." : formatPercent(kpis?.averageEngagement.value ?? null)}
        tone="cyan"
      />
      <KpiCard
        label="On Target"
        value={loading ? "Loading..." : formatPercent(kpis?.onTargetRate.value ?? null)}
        helper={kpis?.onTargetRate.basis ?? undefined}
        tone="orange"
      />
    </section>
  );
}