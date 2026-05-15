import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/metrics/[appId]/route";
import {
  getRuntimeMetricsRepository,
  getRuntimeRepositories,
  resetRuntimeRepositoriesForTests
} from "@/infrastructure/persistence/runtime/repositories";
import { MetricsMemoryRepository } from "@/infrastructure/persistence/memory/MetricsMemoryRepository";

const APP_ID = "10000000-0000-0000-0000-000000000001";

describe("metrics integration - synthetic investment non-production guard", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
  });

  it("returns forbidden when synthetic context is requested in production mode", async () => {
    process.env.NODE_ENV = "production";

    const repositories = getRuntimeRepositories();
    const user = await repositories.users.create({
      username: "prod-admin",
      email: "prod-admin@example.com",
      displayName: "Prod Admin",
      isActive: true,
      actorUserId: "system"
    });
    await repositories.roles.assignRole(user.userId, "administrator", "system");
    await repositories.applications.assignAll(user.userId, "system");

    const repo = getRuntimeMetricsRepository();
    if (!(repo instanceof MetricsMemoryRepository)) {
      throw new Error("Expected MetricsMemoryRepository in tests");
    }

    repo.addSnapshotForTests({
      snapshotId: "50000000-0000-0000-0000-000000000021",
      runId: "70000000-0000-0000-0000-000000000021",
      applicationId: APP_ID,
      applicationName: "Maestro",
      calculationDate: "2026-05-07T10:00:00.000Z",
      denominatorCount: 100,
      numeratorCount: 90,
      matchedCount: 80,
      adoptionPct: 80,
      denominatorRevenue: 100000,
      numeratorRevenue: 70000,
      revenuePct: 70,
      avgEngagement: 4,
      metricDefinitionVersion: "EPIC-007-v1",
      refreshTimestamp: "2026-05-07T10:00:01.000Z",
      sourceBatchId: null,
      filterRuleSnapshotId: null
    });

    const response = await GET(
      new Request("http://localhost/api/metrics/" + APP_ID + "?includeSynthetic=true", {
        method: "GET",
        headers: {
          Authorization: "Bearer " + user.userId
        }
      }),
      { params: Promise.resolve({ appId: APP_ID }) }
    );

    const body = await response.json();
    expect(response.status).toBe(403);
    expect(body.error).toBe("FORBIDDEN");
  });
});
