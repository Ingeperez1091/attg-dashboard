import { describe, expect, it } from "vitest";
import { MetricsRetrievalService } from "@/core/application/services/metricsRetrievalService";
import { IMetricsRepository } from "@/core/domain/repositories/metricsRepository";
import { IApplicationRepository } from "@/core/domain/repositories/IApplicationRepository";
import { SessionEntity } from "@/core/domain/entities/SessionEntity";

const APP_ID = "10000000-0000-0000-0000-000000000001";
const adminSession: SessionEntity = {
  userId: "30000000-0000-0000-0000-000000000001",
  role: "administrator",
  isActive: true,
  applications: ["*"]
};

function createMetricsRepo(snapshotOverrides?: Partial<Awaited<ReturnType<IMetricsRepository["getLatestSnapshot"]>>>): IMetricsRepository {
  const baseSnapshot = {
    snapshotId: "50000000-0000-0000-0000-000000000001",
    runId: "70000000-0000-0000-0000-000000000001",
    applicationId: APP_ID,
    applicationName: "Maestro",
    calculationDate: "2026-05-07T10:00:00.000Z",
    denominatorCount: 0,
    numeratorCount: 0,
    matchedCount: 0,
    adoptionPct: 0,
    denominatorRevenue: null,
    numeratorRevenue: null,
    revenuePct: 0,
    avgEngagement: null,
    metricDefinitionVersion: "EPIC-007-v1",
    refreshTimestamp: "2026-05-07T10:00:01.000Z",
    sourceBatchId: null,
    filterRuleSnapshotId: null
  };

  return {
    getLatestSnapshot: async () => ({ ...baseSnapshot, ...(snapshotOverrides ?? {}) }),
    listSnapshotHistory: async () => ({
      items: [{ ...baseSnapshot, ...(snapshotOverrides ?? {}) }],
      total: 1,
      page: 1,
      pageSize: 20
    }),
    getRunMetricsSummary: async () => ({
      runId: "70000000-0000-0000-0000-000000000001",
      applicationId: APP_ID,
      status: "Completed",
      startTime: "2026-05-07T10:00:00.000Z",
      endTime: "2026-05-07T10:00:01.000Z",
      matchedCount: 0,
      snapshot: { ...baseSnapshot, ...(snapshotOverrides ?? {}) }
    }),
    listSyntheticInvestmentFacts: async () => []
  };
}

const applicationsRepository: IApplicationRepository = {
  listActive: async () => [{
    applicationId: APP_ID,
    applicationName: "Maestro",
    serviceLine: "Tax",
    subServiceLine: "Private Client Services",
    isActive: true,
    createDate: "2026-05-07T10:00:00.000Z",
    createdBy: "seed",
    updateDate: "2026-05-07T10:00:00.000Z",
    updatedBy: "seed"
  }],
  listByUserId: async () => [APP_ID],
  assign: async () => undefined,
  assignAll: async () => undefined,
  unassign: async () => true
};

describe("metrics retrieval service unit - mapping and zero/null behavior", () => {
  it("maps zero denominator and revenue values without coercion errors", async () => {
    const service = new MetricsRetrievalService(createMetricsRepo(), applicationsRepository);
    const latest = await service.getLatestSnapshot(adminSession, { applicationId: APP_ID });

    expect(latest).not.toBeNull();
    expect(latest?.denominatorCount).toBe(0);
    expect(latest?.matchedCount).toBe(0);
    expect(latest?.adoptionPct).toBe(0);
    expect(latest?.revenuePct).toBe(0);
  });

  it("keeps nullable KPI fields as null when source values are absent", async () => {
    const service = new MetricsRetrievalService(createMetricsRepo({ avgEngagement: null }), applicationsRepository);
    const latest = await service.getLatestSnapshot(adminSession, { applicationId: APP_ID });

    expect(latest?.onTarget).toBe(false);
    expect(latest?.avgEngagement).toBeNull();
  });

  it("includes null synthetic context by default", async () => {
    const service = new MetricsRetrievalService(createMetricsRepo(), applicationsRepository);
    const latest = await service.getLatestSnapshot(adminSession, { applicationId: APP_ID });

    expect(latest?.syntheticInvestment).toBeNull();
  });
});
