import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/dashboard/usage/route";
import {
  getRuntimeDashboardUsageRepository,
  resetRuntimeRepositoriesForTests
} from "@/infrastructure/persistence/runtime/repositories";
import { DashboardUsageMemoryRepository } from "@/infrastructure/persistence/memory/DashboardUsageMemoryRepository";

describe("dashboard integration - state behavior", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
  });

  it("returns an empty state when no scoped rows or completed runs exist", async () => {
    const repository = getRuntimeDashboardUsageRepository();
    if (!(repository instanceof DashboardUsageMemoryRepository)) {
      throw new Error("Expected DashboardUsageMemoryRepository in tests");
    }

    repository.setRowsForTests([]);
    repository.setRunContextForTests({ latestCompletedRunId: null, activeRun: null });

    const response = await GET(new Request("http://localhost/api/dashboard/usage", { method: "GET" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.hero).toEqual({
      title: "Application Usage Dashboard",
      latestRunId: null,
      refreshTimestamp: null
    });
    expect(body.kpis).toBeNull();
    expect(body.groups).toEqual([]);
    expect(body.state.state).toBe("empty");
  });

  it("returns inProgress state when a pipeline run is active before the first completed metrics", async () => {
    const repository = getRuntimeDashboardUsageRepository();
    if (!(repository instanceof DashboardUsageMemoryRepository)) {
      throw new Error("Expected DashboardUsageMemoryRepository in tests");
    }

    repository.setRowsForTests([]);
    repository.setRunContextForTests({
      latestCompletedRunId: null,
      activeRun: {
        runId: "70000000-0000-0000-0000-000000000201",
        applicationId: "10000000-0000-0000-0000-000000000001",
        status: "Processing",
        startTime: "2026-05-07T11:00:00.000Z"
      }
    });

    const response = await GET(new Request("http://localhost/api/dashboard/usage", { method: "GET" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.state.state).toBe("inProgress");
    expect(body.state.isRecalculating).toBe(true);
    expect(body.state.message).toBe("Metrics are being calculated for the selected scope.");
  });

  it("preserves the dashboard envelope when retrieval fails", async () => {
    const repository = getRuntimeDashboardUsageRepository();
    if (!(repository instanceof DashboardUsageMemoryRepository)) {
      throw new Error("Expected DashboardUsageMemoryRepository in tests");
    }

    vi.spyOn(repository, "getRunContext").mockRejectedValueOnce(new Error("database unavailable"));

    const response = await GET(new Request("http://localhost/api/dashboard/usage", { method: "GET" }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.hero.title).toBe("Application Usage Dashboard");
    expect(body.groups).toEqual([]);
    expect(body.state.state).toBe("error");
    expect(body.state.message).toBe("Dashboard data is temporarily unavailable.");
  });
});