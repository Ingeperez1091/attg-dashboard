import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/dashboard/usage/route";
import {
  getRuntimeDashboardUsageRepository,
  getRuntimeRepositories,
  resetRuntimeRepositoriesForTests
} from "@/infrastructure/persistence/runtime/repositories";
import { DashboardUsageMemoryRepository } from "@/infrastructure/persistence/memory/DashboardUsageMemoryRepository";

describe("dashboard integration - role scoped payload visibility", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
  });

  it("returns only assigned applications for non-admin users", async () => {
    const usageRepository = getRuntimeDashboardUsageRepository();
    if (!(usageRepository instanceof DashboardUsageMemoryRepository)) {
      throw new Error("Expected DashboardUsageMemoryRepository in tests");
    }

    usageRepository.setRowsForTests([
      {
        snapshotId: "rbac-1",
        runId: "70000000-0000-0000-0000-000000000012",
        applicationId: "10000000-0000-0000-0000-000000000001",
        applicationName: "Maestro",
        subServiceLine: "BTS",
        calculationDate: "2026-05-07T13:00:00.000Z",
        refreshTimestamp: "2026-05-07T13:00:01.000Z",
        metricDefinitionVersion: "EPIC-007-v1",
        denominatorCount: 60,
        numeratorCount: 40,
        matchedCount: 40,
        adoptionPct: 66.67,
        denominatorRevenue: 600,
        numeratorRevenue: 400,
        revenuePct: 66.67,
        avgEngagement: 66,
        investmentAmount: 10
      },
      {
        snapshotId: "rbac-2",
        runId: "70000000-0000-0000-0000-000000000012",
        applicationId: "10000000-0000-0000-0000-000000000002",
        applicationName: "EYST",
        subServiceLine: "ITTS",
        calculationDate: "2026-05-07T13:00:00.000Z",
        refreshTimestamp: "2026-05-07T13:00:01.000Z",
        metricDefinitionVersion: "EPIC-007-v1",
        denominatorCount: 30,
        numeratorCount: 20,
        matchedCount: 20,
        adoptionPct: 66.67,
        denominatorRevenue: 300,
        numeratorRevenue: 200,
        revenuePct: 66.67,
        avgEngagement: 60,
        investmentAmount: 7
      }
    ]);
    usageRepository.setRunContextForTests({
      latestCompletedRunId: "70000000-0000-0000-0000-000000000012",
      activeRun: null
    });

    const repositories = getRuntimeRepositories();
    const viewer = await repositories.users.create({
      username: "scoped_viewer",
      email: "scoped-viewer@example.com",
      displayName: "Scoped Viewer",
      isActive: true,
      actorUserId: "system"
    });
    await repositories.roles.assignRole(viewer.userId, "viewer", "system");
    await repositories.applications.assign(viewer.userId, "10000000-0000-0000-0000-000000000001", "system");

    const response = await GET(
      new Request("http://localhost/api/dashboard/usage", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${viewer.userId}`
        }
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.scope.role).toBe("viewer");
    expect(body.scope.applicationIds).toEqual(["10000000-0000-0000-0000-000000000001"]);
    expect(body.groups).toHaveLength(1);
    expect(body.groups[0].children).toHaveLength(1);
    expect(body.groups[0].children[0].displayName).toBe("Maestro");
  });
});