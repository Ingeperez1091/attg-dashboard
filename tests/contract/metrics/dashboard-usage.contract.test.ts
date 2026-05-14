import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/dashboard/usage/route";
import {
  getRuntimeDashboardUsageRepository,
  resetRuntimeRepositoriesForTests
} from "@/infrastructure/persistence/runtime/repositories";
import { DashboardUsageMemoryRepository } from "@/infrastructure/persistence/memory/DashboardUsageMemoryRepository";

describe("dashboard usage contract - response envelope", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
  });

  it("returns the canonical dashboard envelope with grouped rows and state", async () => {
    const repository = getRuntimeDashboardUsageRepository();
    if (!(repository instanceof DashboardUsageMemoryRepository)) {
      throw new Error("Expected DashboardUsageMemoryRepository in tests");
    }

    repository.setRowsForTests([
      {
        snapshotId: "80000000-0000-0000-0000-000000000001",
        runId: "70000000-0000-0000-0000-000000000001",
        applicationId: "10000000-0000-0000-0000-000000000001",
        applicationName: "Maestro",
        subServiceLine: "BTS",
        calculationDate: "2026-05-07T10:00:00.000Z",
        refreshTimestamp: "2026-05-07T10:00:01.000Z",
        metricDefinitionVersion: "EPIC-007-v1",
        denominatorCount: 100,
        numeratorCount: 80,
        matchedCount: 75,
        adoptionPct: 80,
        denominatorRevenue: 100000,
        numeratorRevenue: 70000,
        revenuePct: 70,
        avgEngagement: 71,
        investmentAmount: 14
      }
    ]);
    repository.setRunContextForTests({
      latestCompletedRunId: "70000000-0000-0000-0000-000000000001",
      activeRun: null
    });

    const response = await GET(new Request("http://localhost/api/dashboard/usage", { method: "GET" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.scope.role).toBe("administrator");
    expect(Array.isArray(body.scope.applicationIds)).toBe(true);
    expect(body.hero.title).toBe("Application Usage Dashboard");
    expect(body.kpis.revenue.label).toBe("Revenue");
    expect(body.kpis.onTargetRate.value).toBe(100);
    expect(body.groups[0].groupType).toBe("subServiceLine");
    expect(body.groups[0].children[0].groupType).toBe("application");
    expect(body.state.state).toBe("ready");
    expect(body.legend.metricDefinitionVersion).toBe("EPIC-007-v1");
  });
});