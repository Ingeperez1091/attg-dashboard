import { beforeEach, describe, expect, it } from "vitest";
import { GET as getMetrics } from "@/app/api/metrics/[appId]/route";
import { GET as getNumeratorFilters } from "@/app/api/filters/numerator/[appId]/route";
import { POST as triggerPipelineRun } from "@/app/api/pipeline/run/route";
import { GET as getValidationSummary } from "@/app/api/pipeline/validation-results/[appId]/summary/route";
import { createSessionUser, resetAuthContractState } from "./auth-test-helpers";

describe("contract - application scope visibility", () => {
  const assignedAppId = "10000000-0000-0000-0000-000000000005";
  const unassignedAppId = "10000000-0000-0000-0000-000000000001";

  beforeEach(() => {
    resetAuthContractState();
  });

  it("allows assigned application reads and rejects unassigned reads for non-admin users", async () => {
    const ownerUserId = await createSessionUser({
      role: "application_owner",
      applicationIds: [assignedAppId]
    });

    const assignedFilterResponse = await getNumeratorFilters(
      new Request(`http://localhost/api/filters/numerator/${assignedAppId}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${ownerUserId}` }
      }),
      { params: Promise.resolve({ appId: assignedAppId }) }
    );

    const unassignedFilterResponse = await getNumeratorFilters(
      new Request(`http://localhost/api/filters/numerator/${unassignedAppId}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${ownerUserId}` }
      }),
      { params: Promise.resolve({ appId: unassignedAppId }) }
    );

    const unassignedMetricsResponse = await getMetrics(
      new Request(`http://localhost/api/metrics/${unassignedAppId}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${ownerUserId}` }
      }),
      { params: Promise.resolve({ appId: unassignedAppId }) }
    );

    const unassignedPipelineRunResponse = await triggerPipelineRun(
      new Request("http://localhost/api/pipeline/run", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ownerUserId}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ applicationId: unassignedAppId })
      })
    );

    const unassignedValidationSummaryResponse = await getValidationSummary(
      new Request(`http://localhost/api/pipeline/validation-results/${unassignedAppId}/summary`, {
        method: "GET",
        headers: { Authorization: `Bearer ${ownerUserId}` }
      }),
      { params: Promise.resolve({ appId: unassignedAppId }) }
    );

    expect(assignedFilterResponse.status).toBe(200);
    expect(unassignedFilterResponse.status).toBe(403);
    expect(unassignedMetricsResponse.status).toBe(403);
    expect(unassignedPipelineRunResponse.status).toBe(403);
    expect(unassignedValidationSummaryResponse.status).toBe(403);
  });
});
