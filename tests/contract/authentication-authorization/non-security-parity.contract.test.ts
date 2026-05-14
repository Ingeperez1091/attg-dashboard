import { beforeEach, describe, expect, it } from "vitest";
import { GET as getMetrics } from "@/app/api/metrics/[appId]/route";
import { GET as getApplicationModel } from "@/app/api/applications/[appId]/numeratormodel/route";
import { GET as getNumeratorFilters } from "@/app/api/filters/numerator/[appId]/route";
import { GET as getDenominatorFilters } from "@/app/api/filters/denominator/[appId]/route";
import { bearerHeaders, createSessionUser, resetAuthContractState } from "./auth-test-helpers";
import { getRuntimeMetricsRepository } from "@/infrastructure/persistence/runtime/repositories";
import { MetricsMemoryRepository } from "@/infrastructure/persistence/memory/MetricsMemoryRepository";

describe("contract - non-security response parity", () => {
  const appId = "10000000-0000-0000-0000-000000000005";

  beforeEach(() => {
    resetAuthContractState();
  });

  it("preserves authorized response contracts for covered endpoints", async () => {
    const ownerUserId = await createSessionUser({ role: "application_owner", applicationIds: [appId] });
    const metricsRepository = getRuntimeMetricsRepository();

    if (!(metricsRepository instanceof MetricsMemoryRepository)) {
      throw new Error("Expected MetricsMemoryRepository in tests");
    }

    metricsRepository.addSnapshotForTests({
      snapshotId: "50000000-0000-0000-0000-000000000099",
      runId: "70000000-0000-0000-0000-000000000099",
      applicationId: appId,
      applicationName: "Navigate",
      calculationDate: "2026-05-07T10:00:00.000Z",
      denominatorCount: 100,
      numeratorCount: 80,
      matchedCount: 80,
      adoptionPct: 80,
      denominatorRevenue: 1000,
      numeratorRevenue: 800,
      revenuePct: 80,
      avgEngagement: 4,
      metricDefinitionVersion: "EPIC-007-v1",
      refreshTimestamp: "2026-05-07T10:00:01.000Z",
      sourceBatchId: null,
      filterRuleSnapshotId: null
    });

    const metricsResponse = await getMetrics(
      new Request(`http://localhost/api/metrics/${appId}`, {
        method: "GET",
        headers: bearerHeaders(ownerUserId)
      }),
      { params: Promise.resolve({ appId }) }
    );
    const metricsBody = await metricsResponse.json();

    const numeratorModelResponse = await getApplicationModel(
      new Request(`http://localhost/api/applications/${appId}/numeratormodel`, {
        method: "GET",
        headers: bearerHeaders(ownerUserId)
      }),
      { params: Promise.resolve({ appId }) }
    );
    const numeratorModelBody = await numeratorModelResponse.json();

    const numeratorRulesResponse = await getNumeratorFilters(
      new Request(`http://localhost/api/filters/numerator/${appId}`, {
        method: "GET",
        headers: bearerHeaders(ownerUserId)
      }),
      { params: Promise.resolve({ appId }) }
    );
    const numeratorRulesBody = await numeratorRulesResponse.json();

    const denominatorRulesResponse = await getDenominatorFilters(
      new Request(`http://localhost/api/filters/denominator/${appId}`, {
        method: "GET",
        headers: bearerHeaders(ownerUserId)
      }),
      { params: Promise.resolve({ appId }) }
    );
    const denominatorRulesBody = await denominatorRulesResponse.json();

    expect(metricsResponse.status).toBe(200);
    expect(metricsBody).toHaveProperty("snapshotId");
    expect(metricsBody).toHaveProperty("applicationId", appId);
    expect(metricsBody).toHaveProperty("onTarget");

    expect(numeratorModelResponse.status).toBe(200);
    expect(numeratorModelBody).toHaveProperty("applicationId", appId);
    expect(numeratorModelBody).toHaveProperty("fields");

    expect(numeratorRulesResponse.status).toBe(200);
    expect(numeratorRulesBody).toHaveProperty("applicationId", appId);
    expect(numeratorRulesBody).toHaveProperty("rules");

    expect(denominatorRulesResponse.status).toBe(200);
    expect(denominatorRulesBody).toHaveProperty("applicationId", appId);
    expect(denominatorRulesBody).toHaveProperty("rules");
  });
});
