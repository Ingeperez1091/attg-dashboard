interface DashboardHeroProps {
  latestRunId: string | null;
  refreshTimestamp: string | null;
  loading?: boolean;
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "Awaiting snapshot";
  }

  return new Date(value).toLocaleString();
}

export function DashboardHero({ latestRunId, refreshTimestamp, loading = false }: DashboardHeroProps) {
  return (
    <header className="dashboard-hero">
      <div className="dashboard-hero__aurora" aria-hidden="true" />
      <div className="dashboard-hero__copy">
        <span className="dashboard-hero__eyebrow">Americas Tax Technology Group</span>
        <h1 className="dashboard-hero__title">Americas Tax Technology Group (ATTG) Product Adoption Metrics Summary</h1>
        <p className="dashboard-hero__subtitle">
          Our key Tax tech investments continue to gain strong traction, powering most of the revenue for the
          services they support and achieving strong adoption.
        </p>
      </div>

      <div className="dashboard-hero__meta">
        <span className="dashboard-hero__badge">Working draft</span>
        <dl className="dashboard-hero__stats">
          <div>
            <dt>Latest run</dt>
            <dd>{loading ? "Loading..." : latestRunId ?? "None"}</dd>
          </div>
          <div>
            <dt>Refreshed</dt>
            <dd>{loading ? "Loading..." : formatTimestamp(refreshTimestamp)}</dd>
          </div>
        </dl>
      </div>
    </header>
  );
}