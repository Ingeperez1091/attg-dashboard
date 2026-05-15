import { beforeEach, describe, expect, it } from "vitest";
import { MetricsRetrievalService } from "@/core/application/services/metricsRetrievalService";
import { getRuntimeRepositories, getRuntimeMetricsRepository, resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";
import { MetricsMemoryRepository } from "@/infrastructure/persistence/memory/MetricsMemoryRepository";
import { SessionEntity } from "@/core/domain/entities/SessionEntity";

const APP_ID = "10000000-0000-0000-0000-000000000001";
const adminSession: SessionEntity = {
  userId: "30000000-0000-0000-0000-000000000001",
  role: "administrator",
  isActive: true,
  applications: ["*"]
};

describe("metrics integration - rule context traceability across runs", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
  });

  it("returns historical snapshots with metric definition version and filter snapshot lineage", async () => {
    const repo = getRuntimeMetricsRepository();
    if (!(repo instanceof MetricsMemoryRepository)) {
      throw new Error("Expected MetricsMemoryRepository in tests");
    }

    repo.addSnapshotForTests({
      snapshotId: "50000000-0000-0000-0000-000000000010",
      runId: "70000000-0000-0000-0000-000000000010",
      applicationId: APP_ID,
      applicationName: "Maestro",
      calculationDate: "2026-05-07T08:00:00.000Z",
      denominatorCount: 100,
      numeratorCount: 85,
      matchedCount: 80,
      adoptionPct: 80,
      denominatorRevenue: 100000,
      numeratorRevenue: 70000,
      revenuePct: 70,
      avgEngagement: 4.1,
      metricDefinitionVersion: "EPIC-007-v1",
      refreshTimestamp: "2026-05-07T08:00:01.000Z",
      sourceBatchId: "batch-a",
      filterRuleSnapshotId: "60000000-0000-0000-0000-000000000010"
    });

    repo.addSnapshotForTests({
      snapshotId: "50000000-0000-0000-0000-000000000011",
      runId: "70000000-0000-0000-0000-000000000011",
      applicationId: APP_ID,
      applicationName: "Maestro",
      calculationDate: "2026-05-07T09:00:00.000Z",
      denominatorCount: 110,
      numeratorCount: 90,
      matchedCount: 88,
      adoptionPct: 80,
      denominatorRevenue: 110000,
      numeratorRevenue: 79200,
      revenuePct: 72,
      avgEngagement: 4.3,
      metricDefinitionVersion: "EPIC-007-v2",
      refreshTimestamp: "2026-05-07T09:00:01.000Z",
      sourceBatchId: "batch-b",
      filterRuleSnapshotId: "60000000-0000-0000-0000-000000000011"
    });

    const service = new MetricsRetrievalService(repo, getRuntimeRepositories().applications);
    const history = await service.getSnapshotHistory(adminSession, {
      applicationId: APP_ID,
      from: null,
      to: null,
      page: 1,
      pageSize: 20
    });

    expect(history.totalCount).toBe(2);
    expect(history.snapshots[0].runId).toBe("70000000-0000-0000-0000-000000000011");
    expect(history.snapshots[0].metricDefinitionVersion).toBe("EPIC-007-v2");
    expect(history.snapshots[0].filterRuleSnapshotId).toBe("60000000-0000-0000-0000-000000000011");
    expect(history.snapshots[1].metricDefinitionVersion).toBe("EPIC-007-v1");
  });
});
