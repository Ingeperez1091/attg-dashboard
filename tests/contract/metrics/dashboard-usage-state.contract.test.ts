import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getDashboardUsage } from "@/app/api/dashboard/usage/route";
import { GET as getDashboardState } from "@/app/api/dashboard/usage/state/route";
import {
  getRuntimeDashboardUsageRepository,
  resetRuntimeRepositoriesForTests
} from "@/infrastructure/persistence/runtime/repositories";
import { DashboardUsageMemoryRepository } from "@/infrastructure/persistence/memory/DashboardUsageMemoryRepository";

describe("dashboard usage contract - state variants", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
  });

  it("returns an empty dashboard envelope when no completed snapshots exist", async () => {
    const repository = getRuntimeDashboardUsageRepository();
    if (!(repository instanceof DashboardUsageMemoryRepository)) {
      throw new Error("Expected DashboardUsageMemoryRepository in tests");
    }

    repository.setRowsForTests([]);
    repository.setRunContextForTests({
      latestCompletedRunId: null,
      activeRun: null
    });

    const response = await getDashboardUsage(new Request("http://localhost/api/dashboard/usage", { method: "GET" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.kpis).toBeNull();
    expect(body.groups).toEqual([]);
    expect(body.state.state).toBe("empty");
    expect(body.state.isRecalculating).toBe(false);
  });

  it("returns in-progress usage and run-state payloads when a scoped run is active", async () => {
    const repository = getRuntimeDashboardUsageRepository();
    if (!(repository instanceof DashboardUsageMemoryRepository)) {
      throw new Error("Expected DashboardUsageMemoryRepository in tests");
    }

    repository.setRowsForTests([
      {
        snapshotId: "snap-progress",
        runId: "70000000-0000-0000-0000-000000000101",
        applicationId: "10000000-0000-0000-0000-000000000001",
        applicationName: "Maestro",
        subServiceLine: "BTS",
        calculationDate: "2026-05-07T10:00:00.000Z",
        refreshTimestamp: "2026-05-07T10:00:01.000Z",
        metricDefinitionVersion: "EPIC-007-v1",
        denominatorCount: 100,
        numeratorCount: 75,
        matchedCount: 75,
        adoptionPct: 75,
        denominatorRevenue: 1000,
        numeratorRevenue: 750,
        revenuePct: 75,
        avgEngagement: 66,
        investmentAmount: 10
      }
    ]);
    repository.setRunContextForTests({
      latestCompletedRunId: "70000000-0000-0000-0000-000000000101",
      activeRun: {
        runId: "70000000-0000-0000-0000-000000000102",
        applicationId: "10000000-0000-0000-0000-000000000001",
        status: "Processing",
        startTime: "2026-05-07T10:05:00.000Z"
      }
    });

    const usageResponse = await getDashboardUsage(new Request("http://localhost/api/dashboard/usage", { method: "GET" }));
    const usageBody = await usageResponse.json();
    const stateResponse = await getDashboardState(new Request("http://localhost/api/dashboard/usage/state", { method: "GET" }));
    const stateBody = await stateResponse.json();

    expect(usageResponse.status).toBe(200);
    expect(usageBody.state.state).toBe("inProgress");
    expect(usageBody.state.lastSuccessfulRunId).toBe("70000000-0000-0000-0000-000000000101");
    expect(stateResponse.status).toBe(200);
    expect(stateBody.activeRun.runId).toBe("70000000-0000-0000-0000-000000000102");
    expect(stateBody.isRecalculating).toBe(true);
  });

  it("returns a non-technical error envelope for retrieval failures", async () => {
    const repository = getRuntimeDashboardUsageRepository();
    if (!(repository instanceof DashboardUsageMemoryRepository)) {
      throw new Error("Expected DashboardUsageMemoryRepository in tests");
    }

    vi.spyOn(repository, "listUsageRows").mockRejectedValueOnce(new Error("boom"));

    const response = await getDashboardUsage(new Request("http://localhost/api/dashboard/usage", { method: "GET" }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("DASHBOARD_DATA_UNAVAILABLE");
    expect(body.state.state).toBe("error");
    expect(body.state.message).toBe("Dashboard data is temporarily unavailable.");
    expect(body.hero.title).toBe("Application Usage Dashboard");
  });
});