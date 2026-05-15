import { describe, expect, it } from "vitest";
import { resolveDashboardState } from "@/core/application/services/dashboardStateService";

describe("dashboard state service unit - transitions", () => {
  it("returns empty when no rows and no run context exist", () => {
    const result = resolveDashboardState({
      rows: [],
      runContext: {
        latestCompletedRunId: null,
        activeRun: null
      }
    });

    expect(result.state).toBe("empty");
    expect(result.isRecalculating).toBe(false);
  });

  it("returns inProgress when an active run exists before the first completed snapshot", () => {
    const result = resolveDashboardState({
      rows: [],
      runContext: {
        latestCompletedRunId: null,
        activeRun: {
          runId: "run-active",
          applicationId: "app-1",
          status: "Processing",
          startTime: "2026-05-07T10:00:00.000Z"
        }
      }
    });

    expect(result.state).toBe("inProgress");
    expect(result.message).toBe("Metrics are being calculated for the selected scope.");
    expect(result.lastSuccessfulRunId).toBeNull();
  });

  it("returns inProgress while preserving the last completed run when recalculation is active", () => {
    const result = resolveDashboardState({
      rows: [
        {
          snapshotId: "snap-1",
          runId: "run-complete",
          applicationId: "app-1",
          applicationName: "Maestro",
          subServiceLine: "BTS",
          calculationDate: "2026-05-07T10:00:00.000Z",
          refreshTimestamp: "2026-05-07T10:00:01.000Z",
          metricDefinitionVersion: "EPIC-007-v1",
          denominatorCount: 10,
          numeratorCount: 8,
          matchedCount: 8,
          adoptionPct: 80,
          denominatorRevenue: 100,
          numeratorRevenue: 80,
          revenuePct: 80,
          avgEngagement: 70,
          investmentAmount: 10
        }
      ],
      runContext: {
        latestCompletedRunId: "run-complete",
        activeRun: {
          runId: "run-active",
          applicationId: "app-1",
          status: "Queued",
          startTime: null
        }
      }
    });

    expect(result.state).toBe("inProgress");
    expect(result.lastSuccessfulRunId).toBe("run-complete");
    expect(result.isRecalculating).toBe(true);
  });

  it("returns error when retrieval fails", () => {
    const result = resolveDashboardState({
      rows: [],
      runContext: {
        latestCompletedRunId: "run-complete",
        activeRun: null
      },
      hadError: true
    });

    expect(result.state).toBe("error");
    expect(result.message).toBe("Dashboard data is temporarily unavailable.");
  });
});