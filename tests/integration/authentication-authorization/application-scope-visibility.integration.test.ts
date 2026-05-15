import { beforeEach, describe, expect, it } from "vitest";
import { GET as getDashboardUsage } from "@/app/api/dashboard/usage/route";
import { GET as getApplicationModel } from "@/app/api/applications/[appId]/numeratormodel/route";
import { getRuntimeDashboardUsageRepository } from "@/infrastructure/persistence/runtime/repositories";
import { DashboardUsageMemoryRepository } from "@/infrastructure/persistence/memory/DashboardUsageMemoryRepository";
import { createSessionUser, resetAuthIntegrationState } from "./auth-test-helpers";

describe("integration - application scoped visibility", () => {
  const assignedAppId = "10000000-0000-0000-0000-000000000001";
  const unassignedAppId = "10000000-0000-0000-0000-000000000002";

  beforeEach(() => {
    resetAuthIntegrationState();
  });

  it("returns only assigned applications in dashboard usage payload", async () => {
    const usageRepository = getRuntimeDashboardUsageRepository();
    if (!(usageRepository instanceof DashboardUsageMemoryRepository)) {
      throw new Error("Expected DashboardUsageMemoryRepository in tests");
    }

    usageRepository.setRowsForTests([
      {
        snapshotId: "scope-1",
        runId: "70000000-0000-0000-0000-000000000111",
        applicationId: assignedAppId,
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
        snapshotId: "scope-2",
        runId: "70000000-0000-0000-0000-000000000111",
        applicationId: unassignedAppId,
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
      latestCompletedRunId: "70000000-0000-0000-0000-000000000111",
      activeRun: null
    });

    const ownerUserId = await createSessionUser({
      role: "application_owner",
      applicationIds: [assignedAppId]
    });

    const usageResponse = await getDashboardUsage(
      new Request("http://localhost/api/dashboard/usage", {
        method: "GET",
        headers: { Authorization: `Bearer ${ownerUserId}` }
      })
    );

    expect(usageResponse.status).toBe(200);
    const usageBody = await usageResponse.json();
    expect(usageBody.scope.applicationIds).toEqual([assignedAppId]);
    expect(JSON.stringify(usageBody)).not.toContain(unassignedAppId);
  });

  it("rejects direct reads for unassigned application resources", async () => {
    const ownerUserId = await createSessionUser({
      role: "application_owner",
      applicationIds: [assignedAppId]
    });

    const response = await getApplicationModel(
      new Request(`http://localhost/api/applications/${unassignedAppId}/numeratormodel`, {
        method: "GET",
        headers: { Authorization: `Bearer ${ownerUserId}` }
      }),
      { params: Promise.resolve({ appId: unassignedAppId }) }
    );

    expect(response.status).toBe(403);

    const assignedResponse = await getApplicationModel(
      new Request(`http://localhost/api/applications/${assignedAppId}/numeratormodel`, {
        method: "GET",
        headers: { Authorization: `Bearer ${ownerUserId}` }
      }),
      { params: Promise.resolve({ appId: assignedAppId }) }
    );

    expect(assignedResponse.status).toBe(200);
  });
});
