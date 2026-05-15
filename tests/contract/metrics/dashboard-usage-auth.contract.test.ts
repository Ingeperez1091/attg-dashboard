import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/dashboard/usage/route";
import {
  getRuntimeDashboardUsageRepository,
  getRuntimeRepositories,
  getRuntimeValidationPipelineRepository,
  resetRuntimeRepositoriesForTests
} from "@/infrastructure/persistence/runtime/repositories";
import { DashboardUsageMemoryRepository } from "@/infrastructure/persistence/memory/DashboardUsageMemoryRepository";
import { ValidationPipelineMemoryRepository } from "@/infrastructure/persistence/memory/ValidationPipelineMemoryRepository";

describe("dashboard usage contract - auth failures", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    delete process.env.DEV_SESSION_USER_ID;
    resetRuntimeRepositoriesForTests();
  });

  it("returns unauthorized when no active session is available", async () => {
    const response = await GET(new Request("http://localhost/api/dashboard/usage", { method: "GET" }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("UNAUTHORIZED");
  });

  it("returns forbidden when a user requests a run outside their assigned scope", async () => {
    const repositories = getRuntimeRepositories();
    const user = await repositories.users.create({
      username: "dashboard_viewer",
      email: "dashboard-viewer@example.com",
      displayName: "Dashboard Viewer",
      isActive: true,
      actorUserId: "system"
    });
    await repositories.roles.assignRole(user.userId, "viewer", "system");
    await repositories.applications.assign(user.userId, "10000000-0000-0000-0000-000000000001", "system");

    const usageRepository = getRuntimeDashboardUsageRepository();
    if (!(usageRepository instanceof DashboardUsageMemoryRepository)) {
      throw new Error("Expected DashboardUsageMemoryRepository in tests");
    }

    usageRepository.setRowsForTests([
      {
        snapshotId: "80000000-0000-0000-0000-000000000010",
        runId: "70000000-0000-0000-0000-000000000010",
        applicationId: "10000000-0000-0000-0000-000000000002",
        applicationName: "EYST",
        subServiceLine: "BTS",
        calculationDate: "2026-05-07T10:00:00.000Z",
        refreshTimestamp: "2026-05-07T10:00:01.000Z",
        metricDefinitionVersion: "EPIC-007-v1",
        denominatorCount: 100,
        numeratorCount: 40,
        matchedCount: 40,
        adoptionPct: 40,
        denominatorRevenue: 100,
        numeratorRevenue: 40,
        revenuePct: 40,
        avgEngagement: 40,
        investmentAmount: 5
      }
    ]);

    const validationRepository = getRuntimeValidationPipelineRepository();
    if (!(validationRepository instanceof ValidationPipelineMemoryRepository)) {
      throw new Error("Expected ValidationPipelineMemoryRepository in tests");
    }

    await validationRepository.createRun({
      runId: "70000000-0000-0000-0000-000000000010",
      applicationId: "10000000-0000-0000-0000-000000000002",
      triggerSource: "API",
      actorUserId: "system"
    });

    const response = await GET(
      new Request("http://localhost/api/dashboard/usage?runId=70000000-0000-0000-0000-000000000010", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${user.userId}`
        }
      })
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("FORBIDDEN");
  });
});