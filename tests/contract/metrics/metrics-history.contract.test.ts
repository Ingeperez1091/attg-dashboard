import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/metrics/history/[appId]/route";
import { resetRuntimeRepositoriesForTests, getRuntimeMetricsRepository } from "@/infrastructure/persistence/runtime/repositories";
import { MetricsMemoryRepository } from "@/infrastructure/persistence/memory/MetricsMemoryRepository";

const APP_ID = "10000000-0000-0000-0000-000000000001";

describe("metrics history contract - payload shape", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
  });

  it("returns paginated history shape with traceability fields", async () => {
    const repo = getRuntimeMetricsRepository();
    if (!(repo instanceof MetricsMemoryRepository)) {
      throw new Error("Expected MetricsMemoryRepository in tests");
    }

    repo.addSnapshotForTests({
      snapshotId: "50000000-0000-0000-0000-000000000001",
      runId: "70000000-0000-0000-0000-000000000001",
      applicationId: APP_ID,
      applicationName: "Maestro",
      calculationDate: "2026-05-07T10:00:00.000Z",
      denominatorCount: 100,
      numeratorCount: 80,
      matchedCount: 75,
      adoptionPct: 75,
      denominatorRevenue: 100000,
      numeratorRevenue: 70000,
      revenuePct: 70,
      avgEngagement: 4.2,
      metricDefinitionVersion: "EPIC-007-v1",
      refreshTimestamp: "2026-05-07T10:00:01.000Z",
      sourceBatchId: "batch-001",
      filterRuleSnapshotId: "60000000-0000-0000-0000-000000000001"
    });

    const response = await GET(
      new Request("http://localhost/api/metrics/history/" + APP_ID + "?page=1&pageSize=20", { method: "GET" }),
      { params: Promise.resolve({ appId: APP_ID }) }
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.applicationId).toBe(APP_ID);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(20);
    expect(Array.isArray(body.snapshots)).toBe(true);
    expect(body.snapshots[0].metricDefinitionVersion).toBe("EPIC-007-v1");
    expect(body.snapshots[0].sourceBatchId).toBe("batch-001");
    expect(body.snapshots[0].filterRuleSnapshotId).toBe("60000000-0000-0000-0000-000000000001");
  });
});
