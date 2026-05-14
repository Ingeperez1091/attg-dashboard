import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/dashboard/usage/route";
import {
  getRuntimeDashboardUsageRepository,
  resetRuntimeRepositoriesForTests
} from "@/infrastructure/persistence/runtime/repositories";
import { DashboardUsageMemoryRepository } from "@/infrastructure/persistence/memory/DashboardUsageMemoryRepository";

describe("dashboard integration - sub service line fallback", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
  });

  it("returns fallback-grouped rows when the Unassigned filter is requested", async () => {
    const repository = getRuntimeDashboardUsageRepository();
    if (!(repository instanceof DashboardUsageMemoryRepository)) {
      throw new Error("Expected DashboardUsageMemoryRepository in tests");
    }

    repository.setRowsForTests([
      {
        snapshotId: "snap-unassigned",
        runId: "70000000-0000-0000-0000-000000000301",
        applicationId: "10000000-0000-0000-0000-000000000003",
        applicationName: "Vector",
        subServiceLine: null,
        calculationDate: "2026-05-07T12:00:00.000Z",
        refreshTimestamp: "2026-05-07T12:00:01.000Z",
        metricDefinitionVersion: "EPIC-007-v1",
        denominatorCount: 25,
        numeratorCount: 12,
        matchedCount: 12,
        adoptionPct: 48,
        denominatorRevenue: 250,
        numeratorRevenue: 140,
        revenuePct: 56,
        avgEngagement: null,
        investmentAmount: null
      }
    ]);
    repository.setRunContextForTests({
      latestCompletedRunId: "70000000-0000-0000-0000-000000000301",
      activeRun: null
    });

    const response = await GET(new Request("http://localhost/api/dashboard/usage?subServiceLine=Unassigned", { method: "GET" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.scope.selectedSubServiceLine).toBe("Unassigned");
    expect(body.groups).toHaveLength(1);
    expect(body.groups[0].displayName).toBe("Unassigned");
    expect(body.groups[0].children[0].displayName).toBe("Vector");
  });
});