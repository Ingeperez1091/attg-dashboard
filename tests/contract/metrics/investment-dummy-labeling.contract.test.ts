import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/metrics/[appId]/route";
import { getRuntimeMetricsRepository, resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";
import { MetricsMemoryRepository } from "@/infrastructure/persistence/memory/MetricsMemoryRepository";

const APP_ID = "10000000-0000-0000-0000-000000000001";

describe("metrics contract - synthetic investment labeling", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
  });

  it("returns labeled non-authoritative synthetic context when requested in non-production", async () => {
    const repo = getRuntimeMetricsRepository();
    if (!(repo instanceof MetricsMemoryRepository)) {
      throw new Error("Expected MetricsMemoryRepository in tests");
    }

    repo.addSnapshotForTests({
      snapshotId: "50000000-0000-0000-0000-000000000020",
      runId: "70000000-0000-0000-0000-000000000020",
      applicationId: APP_ID,
      applicationName: "Maestro",
      calculationDate: "2026-05-07T10:00:00.000Z",
      denominatorCount: 120,
      numeratorCount: 90,
      matchedCount: 80,
      adoptionPct: 66.6667,
      denominatorRevenue: 120000,
      numeratorRevenue: 73500,
      revenuePct: 61.25,
      avgEngagement: 4.05,
      metricDefinitionVersion: "EPIC-007-v1",
      refreshTimestamp: "2026-05-07T10:00:01.000Z",
      sourceBatchId: "batch-020",
      filterRuleSnapshotId: "60000000-0000-0000-0000-000000000020"
    });

    repo.addSyntheticFactForTests({
      investmentId: "80000000-0000-0000-0000-000000000001",
      applicationId: APP_ID,
      calculationDate: "2026-05-01T00:00:00.000Z",
      investmentAmount: 75000,
      isSynthetic: true,
      syntheticBusinessKey: APP_ID + "|2026-05-01|EPIC007",
      sourceBatchId: "epic-007-seed-20260501"
    });

    const response = await GET(
      new Request("http://localhost/api/metrics/" + APP_ID + "?includeSynthetic=true", { method: "GET" }),
      { params: Promise.resolve({ appId: APP_ID }) }
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.syntheticInvestment).not.toBeNull();
    expect(body.syntheticInvestment.isSynthetic).toBe(true);
    expect(body.syntheticInvestment.nonAuthoritativeLabel).toBe("NON_AUTHORITATIVE_SYNTHETIC");
    expect(body.syntheticInvestment.investmentAmount).toBe(75000);
  });
});
