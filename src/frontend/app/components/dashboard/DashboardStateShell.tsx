import { ReactNode } from "react";
import { DashboardStateIndicator } from "@/core/domain/entities/DashboardUsageView";

interface DashboardStateShellProps {
  state: DashboardStateIndicator | null;
  loading?: boolean;
  children: ReactNode;
}

function secondaryMessage(state: DashboardStateIndicator | null): string | null {
  if (!state) {
    return null;
  }

  if (state.state === "inProgress" && state.lastSuccessfulRunId) {
    return `Latest completed run: ${state.lastSuccessfulRunId}`;
  }

  if (state.state === "error") {
    return "Please try again after the current refresh cycle completes.";
  }

  return null;
}

export function DashboardStateShell({ state, loading = false, children }: Readonly<DashboardStateShellProps>) {
  const tone = state?.state ?? "ready";
  const showBanner = loading || (state !== null && state.state !== "ready");
  const subtitle = loading ? null : secondaryMessage(state);

  return (
    <section className="dashboard-state-shell" aria-live="polite">
      {showBanner ? (
        <div className={`dashboard-state-shell__banner dashboard-state-shell__banner--${loading ? "loading" : tone}`}>
          <strong className="dashboard-state-shell__title">
            {loading ? "Loading dashboard metrics" : state?.message}
          </strong>
          {loading ? (
            <span className="dashboard-state-shell__subtitle">Retrieving the latest scoped dashboard snapshot.</span>
          ) : (
            subtitle && <span className="dashboard-state-shell__subtitle">{subtitle}</span>
          )}
        </div>
      ) : null}

      <div className="dashboard-state-shell__content">{children}</div>
    </section>
  );
}