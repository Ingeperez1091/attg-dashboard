import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/dashboard/usage/route";
import {
  getRuntimeDashboardUsageRepository,
  resetRuntimeRepositoriesForTests
} from "@/infrastructure/persistence/runtime/repositories";
import { DashboardUsageMemoryRepository } from "@/infrastructure/persistence/memory/DashboardUsageMemoryRepository";

describe("dashboard integration - grouped hierarchy rendering data", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
  });

  it("returns sub service line groups with alphabetized application children", async () => {
    const repository = getRuntimeDashboardUsageRepository();
    if (!(repository instanceof DashboardUsageMemoryRepository)) {
      throw new Error("Expected DashboardUsageMemoryRepository in tests");
    }

    repository.setRowsForTests([
      {
        snapshotId: "snap-a",
        runId: "70000000-0000-0000-0000-000000000011",
        applicationId: "10000000-0000-0000-0000-000000000003",
        applicationName: "Vector",
        subServiceLine: "Indirect Tax",
        calculationDate: "2026-05-07T12:00:00.000Z",
        refreshTimestamp: "2026-05-07T12:00:01.000Z",
        metricDefinitionVersion: "EPIC-007-v1",
        denominatorCount: 40,
        numeratorCount: 20,
        matchedCount: 20,
        adoptionPct: 50,
        denominatorRevenue: 400,
        numeratorRevenue: 200,
        revenuePct: 50,
        avgEngagement: 42,
        investmentAmount: 3
      },
      {
        snapshotId: "snap-b",
        runId: "70000000-0000-0000-0000-000000000011",
        applicationId: "10000000-0000-0000-0000-000000000001",
        applicationName: "Maestro",
        subServiceLine: "BTS",
        calculationDate: "2026-05-07T12:00:00.000Z",
        refreshTimestamp: "2026-05-07T12:00:01.000Z",
        metricDefinitionVersion: "EPIC-007-v1",
        denominatorCount: 60,
        numeratorCount: 45,
        matchedCount: 45,
        adoptionPct: 75,
        denominatorRevenue: 600,
        numeratorRevenue: 450,
        revenuePct: 75,
        avgEngagement: 82,
        investmentAmount: 12
      },
      {
        snapshotId: "snap-c",
        runId: "70000000-0000-0000-0000-000000000011",
        applicationId: "10000000-0000-0000-0000-000000000002",
        applicationName: "EY Share Trust",
        subServiceLine: "BTS",
        calculationDate: "2026-05-07T12:00:00.000Z",
        refreshTimestamp: "2026-05-07T12:00:01.000Z",
        metricDefinitionVersion: "EPIC-007-v1",
        denominatorCount: 50,
        numeratorCount: 47,
        matchedCount: 47,
        adoptionPct: 94,
        denominatorRevenue: 500,
        numeratorRevenue: 485,
        revenuePct: 97,
        avgEngagement: 90,
        investmentAmount: 14
      }
    ]);
    repository.setRunContextForTests({
      latestCompletedRunId: "70000000-0000-0000-0000-000000000011",
      activeRun: null
    });

    const response = await GET(new Request("http://localhost/api/dashboard/usage", { method: "GET" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.groups).toHaveLength(2);
    expect(body.groups[0].displayName).toBe("BTS");
    expect(body.groups[0].children.map((child: { displayName: string }) => child.displayName)).toEqual([
      "EY Share Trust",
      "Maestro"
    ]);
  });
});