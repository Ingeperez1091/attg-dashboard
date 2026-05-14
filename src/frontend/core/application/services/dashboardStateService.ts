import {
  DashboardRunContext,
  DashboardStateIndicator,
  DashboardUsageSnapshotRow
} from "@/core/domain/entities/DashboardUsageView";

export function resolveDashboardState(input: {
  rows: DashboardUsageSnapshotRow[];
  runContext: DashboardRunContext;
  hadError?: boolean;
}): DashboardStateIndicator {
  if (input.hadError) {
    return {
      state: "error",
      message: "Dashboard data is temporarily unavailable.",
      lastSuccessfulRunId: input.runContext.latestCompletedRunId,
      isRecalculating: false
    };
  }

  const hasRows = input.rows.length > 0;
  const hasActiveRun = Boolean(input.runContext.activeRun);
  const hasCompletedRun = Boolean(input.runContext.latestCompletedRunId);

  if (!hasRows && hasActiveRun) {
    return {
      state: "inProgress",
      message: hasCompletedRun
        ? "Recalculation is in progress. Showing the latest completed metrics."
        : "Metrics are being calculated for the selected scope.",
      lastSuccessfulRunId: input.runContext.latestCompletedRunId,
      isRecalculating: true
    };
  }

  if (!hasRows) {
    return {
      state: "empty",
      message: "No completed metrics are available for the selected scope.",
      lastSuccessfulRunId: input.runContext.latestCompletedRunId,
      isRecalculating: false
    };
  }

  if (hasActiveRun && hasCompletedRun) {
    return {
      state: "inProgress",
      message: "Recalculation is in progress. Showing the latest completed metrics.",
      lastSuccessfulRunId: input.runContext.latestCompletedRunId,
      isRecalculating: true
    };
  }

  return {
    state: "ready",
    message: "Metrics loaded successfully.",
    lastSuccessfulRunId: input.runContext.latestCompletedRunId,
    isRecalculating: hasActiveRun
  };
}
