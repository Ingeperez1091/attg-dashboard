import { beforeEach, describe, expect, it } from "vitest";
import { GET, PUT } from "@/app/api/filters/denominator/[appId]/settings/route";
import {
  resetRuntimeDenominatorFilterRepositoryForTests,
  resetRuntimeRepositoriesForTests
} from "@/infrastructure/persistence/runtime/repositories";

describe("integration - adoption settings persistence", () => {
  const appId = "10000000-0000-0000-0000-000000000001";

  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
    resetRuntimeDenominatorFilterRepositoryForTests();
  });

  it("stores and retrieves adoption settings via GET after PUT", async () => {
    const putResponse = await PUT(new Request(`http://localhost/api/filters/denominator/${appId}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adoptionLevel: "Client",
        revenueMetric: "FYTD_TERAmt",
        numeratorSource: "Manual"
      })
    }), { params: Promise.resolve({ appId }) });

    expect(putResponse.status).toBe(200);

    const getResponse = await GET(new Request(`http://localhost/api/filters/denominator/${appId}/settings`, {
      method: "GET"
    }), { params: Promise.resolve({ appId }) });

    const getBody = await getResponse.json();

    expect(getResponse.status).toBe(200);
    expect(getBody.adoptionLevel).toBe("Client");
    expect(getBody.revenueMetric).toBe("FYTD_TERAmt");
    expect(getBody.numeratorSource).toBe("Manual");
    expect(getBody.applicationId).toBe(appId);
  });

  it("overwrites previous settings on second PUT", async () => {
    await PUT(new Request(`http://localhost/api/filters/denominator/${appId}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adoptionLevel: "Engagement",
        revenueMetric: "ETD_ANSRAmt",
        numeratorSource: "API"
      })
    }), { params: Promise.resolve({ appId }) });

    const secondPut = await PUT(new Request(`http://localhost/api/filters/denominator/${appId}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adoptionLevel: "Client",
        revenueMetric: "FYTD_TERAmt",
        numeratorSource: "Manual"
      })
    }), { params: Promise.resolve({ appId }) });

    expect(secondPut.status).toBe(200);

    const getResponse = await GET(new Request(`http://localhost/api/filters/denominator/${appId}/settings`, {
      method: "GET"
    }), { params: Promise.resolve({ appId }) });

    const getBody = await getResponse.json();

    expect(getBody.adoptionLevel).toBe("Client");
    expect(getBody.revenueMetric).toBe("FYTD_TERAmt");
    expect(getBody.numeratorSource).toBe("Manual");
  });

  it("returns settings without applicationId in body for unknown app when no settings set", async () => {
    const unknownAppId = "10000000-0000-0000-0000-000000000099";

    const getResponse = await GET(new Request(`http://localhost/api/filters/denominator/${unknownAppId}/settings`, {
      method: "GET"
    }), { params: Promise.resolve({ appId: unknownAppId }) });

    const getBody = await getResponse.json();

    expect(getResponse.status).toBe(200);
    expect(getBody.applicationId).toBe(unknownAppId);
    expect(getBody.adoptionLevel).toBeNull();
  });
});
