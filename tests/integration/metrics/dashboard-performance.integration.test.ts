import { performance } from "node:perf_hooks";
import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/dashboard/usage/route";
import {
  getRuntimeDashboardUsageRepository,
  resetRuntimeRepositoriesForTests
} from "@/infrastructure/persistence/runtime/repositories";
import { DashboardUsageMemoryRepository } from "@/infrastructure/persistence/memory/DashboardUsageMemoryRepository";

describe("dashboard integration - performance", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
  });

  it("loads the dashboard usage payload in under three seconds for standard scope", async () => {
    const repository = getRuntimeDashboardUsageRepository();
    if (!(repository instanceof DashboardUsageMemoryRepository)) {
      throw new Error("Expected DashboardUsageMemoryRepository in tests");
    }

    const rows = Array.from({ length: 250 }, (_, index) => ({
      snapshotId: `snap-${index + 1}`,
      runId: "70000000-0000-0000-0000-000000000401",
      applicationId: `10000000-0000-0000-0000-${String(index % 5 + 1).padStart(12, "0")}`,
      applicationName: ["Maestro", "EYST", "Prodigy", "Vector", "Navigate"][index % 5],
      subServiceLine: ["BTS", "Indirect Tax", "Global Compliance", null, "Managed Services"][index % 5],
      calculationDate: `2026-05-07T12:${String(index % 60).padStart(2, "0")}:00.000Z`,
      refreshTimestamp: "2026-05-07T13:00:00.000Z",
      metricDefinitionVersion: "EPIC-007-v1",
      denominatorCount: 100 + index,
      numeratorCount: 60 + index,
      matchedCount: 55 + index,
      adoptionPct: 65,
      denominatorRevenue: 1000 + index,
      numeratorRevenue: 700 + index,
      revenuePct: 70,
      avgEngagement: 72,
      investmentAmount: 15
    }));

    repository.setRowsForTests(rows);
    repository.setRunContextForTests({
      latestCompletedRunId: "70000000-0000-0000-0000-000000000401",
      activeRun: null
    });

    const started = performance.now();
    const response = await GET(new Request("http://localhost/api/dashboard/usage", { method: "GET" }));
    const body = await response.json();
    const durationMs = performance.now() - started;

    expect(response.status).toBe(200);
    expect(body.state.state).toBe("ready");
    expect(durationMs).toBeLessThan(3000);
  });
});