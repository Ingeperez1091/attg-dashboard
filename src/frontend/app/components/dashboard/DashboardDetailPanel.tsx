import { DashboardGroup, DashboardStateIndicator } from "@/core/domain/entities/DashboardUsageView";
import { toDashboardFilterTabId } from "@/app/components/dashboard/dashboardAccessibility";

interface DashboardDetailPanelProps {
  activeFilter: string;
  groups: DashboardGroup[];
  state: DashboardStateIndicator | null;
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

function StatusChip({ status }: { status: DashboardGroup["metrics"]["status"] }) {
  const tone = status === "On Target" ? "on" : status === "Below Target" ? "off" : "unknown";

  return (
    <span className={`dashboard-status dashboard-status--${tone}`}>
      {status}
    </span>
  );
}

function Meter({ label, value, tone }: { label: string; value: number; tone: "violet" | "cyan" | "orange" }) {
  return (
    <div className="dashboard-meter">
      <span className="dashboard-meter__label">{label}</span>
      <div className="dashboard-meter__track" aria-hidden="true">
        <span
          className={`dashboard-meter__fill dashboard-meter__fill--${tone}`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
      <span className="dashboard-meter__value">{Math.round(value)}%</span>
    </div>
  );
}

export function DashboardDetailPanel({ activeFilter, groups, state, loading = false }: DashboardDetailPanelProps) {
  if (loading) {
    return (
      <section
        id="dashboard-detail-panel"
        className="dashboard-detail-panel dashboard-detail-panel--empty"
        role="tabpanel"
        aria-labelledby={toDashboardFilterTabId(activeFilter)}
      >
        Loading dashboard sections...
      </section>
    );
  }

  if (groups.length === 0) {
    return (
      <section
        id="dashboard-detail-panel"
        className="dashboard-detail-panel dashboard-detail-panel--empty"
        role="tabpanel"
        aria-labelledby={toDashboardFilterTabId(activeFilter)}
      >
        <strong>{state?.state === "empty" ? "No metrics available" : "No grouped rows returned"}</strong>
        <p>{state?.message ?? "Dashboard data is not currently available for this selection."}</p>
      </section>
    );
  }

  return (
    <section
      id="dashboard-detail-panel"
      className="dashboard-detail-panel"
      role="tabpanel"
      tabIndex={0}
      aria-labelledby={toDashboardFilterTabId(activeFilter)}
      aria-label="Grouped application metrics"
    >
      {groups.map((group, index) => (
        <article
          key={group.groupKey}
          className={`dashboard-group dashboard-group--${index % 4}`}
          role="group"
          tabIndex={0}
          aria-labelledby={`dashboard-group-title-${group.groupKey}`}
        >
          <header className="dashboard-group__header">
            <div>
              <span className="dashboard-group__eyebrow">Sub Service Line</span>
              <h2 id={`dashboard-group-title-${group.groupKey}`} className="dashboard-group__title">{group.displayName}</h2>
              <p className="dashboard-group__summary">
                {group.children.length} applications <span aria-hidden="true">•</span> {group.children.filter((child) => child.metrics.status === "On Target").length} on target
              </p>
            </div>

            <dl className="dashboard-group__rollup">
              <div>
                <dt>Investment</dt>
                <dd>{formatCompactCurrency(group.metrics.investmentAmount)}</dd>
              </div>
              <div>
                <dt>Revenue</dt>
                <dd>{formatCompactCurrency(group.metrics.numeratorRevenue)}</dd>
              </div>
              <div>
                <dt>Avg. Engagement</dt>
                <dd>{formatPercent(group.metrics.averageEngagement)}</dd>
              </div>
            </dl>
          </header>

          <div className="dashboard-group__rows" role="list" aria-label={`${group.displayName} applications`}>
            {group.children.map((child) => (
              <article
                key={child.groupKey}
                className="dashboard-row"
                role="listitem"
                aria-label={`${child.displayName} status ${child.metrics.status}`}
              >
                <div className="dashboard-row__headline">
                  <h3>{child.displayName}</h3>
                  <StatusChip status={child.metrics.status} />
                </div>

                <dl className="dashboard-row__facts">
                  <div>
                    <dt>Investment</dt>
                    <dd>{formatCompactCurrency(child.metrics.investmentAmount)}</dd>
                  </div>
                  <div>
                    <dt>Revenue</dt>
                    <dd>{formatCompactCurrency(child.metrics.numeratorRevenue)}</dd>
                  </div>
                  <div>
                    <dt>Matched</dt>
                    <dd>{child.metrics.matchedCount}</dd>
                  </div>
                </dl>

                <div className="dashboard-row__meters">
                  <Meter label="Engagement" value={child.metrics.adoptionPct} tone="violet" />
                  <Meter label="Revenue Share" value={child.metrics.revenuePct} tone="cyan" />
                </div>
              </article>
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}