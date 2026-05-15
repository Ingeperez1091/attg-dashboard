import { beforeEach, describe, expect, it } from "vitest";
import { PUT } from "@/app/api/filters/denominator/[appId]/settings/route";
import {
  resetRuntimeDenominatorFilterRepositoryForTests,
  resetRuntimeRepositoriesForTests
} from "@/infrastructure/persistence/runtime/repositories";

describe("contract - PUT /api/filters/denominator/:appId/settings", () => {
  const appId = "10000000-0000-0000-0000-000000000001";

  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
    resetRuntimeDenominatorFilterRepositoryForTests();
  });

  it("returns 200 with persisted adoption settings", async () => {
    const response = await PUT(new Request(`http://localhost/api/filters/denominator/${appId}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adoptionLevel: "Engagement",
        revenueMetric: "FYTD_ANSRAmt",
        numeratorSource: "Manual"
      })
    }), { params: Promise.resolve({ appId }) });

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.applicationId).toBe(appId);
    expect(body.adoptionLevel).toBe("Engagement");
    expect(body.revenueMetric).toBe("FYTD_ANSRAmt");
    expect(body.numeratorSource).toBe("Manual");
  });

  it("returns 400 with VALIDATION_ERROR for invalid adoptionLevel", async () => {
    const response = await PUT(new Request(`http://localhost/api/filters/denominator/${appId}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adoptionLevel: "team",
        revenueMetric: "ETD_ANSRAmt",
        numeratorSource: "API"
      })
    }), { params: Promise.resolve({ appId }) });

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("VALIDATION_ERROR");
    expect(body.details.code).toBe("INVALID_REQUEST_BODY");
  });

  it("returns 400 with VALIDATION_ERROR for invalid numeratorSource", async () => {
    const response = await PUT(new Request(`http://localhost/api/filters/denominator/${appId}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adoptionLevel: "Client",
        revenueMetric: "ETD_ANSRAmt",
        numeratorSource: "File"
      })
    }), { params: Promise.resolve({ appId }) });

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("VALIDATION_ERROR");
    expect(body.details.code).toBe("INVALID_REQUEST_BODY");
  });

  it("returns 400 when revenueMetric validates as empty string", async () => {
    const response = await PUT(new Request(`http://localhost/api/filters/denominator/${appId}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adoptionLevel: "Client",
        revenueMetric: "",
        numeratorSource: "API"
      })
    }), { params: Promise.resolve({ appId }) });

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("VALIDATION_ERROR");
  });

  it("returns 401 when no session is present", async () => {
    delete process.env.DEV_SESSION_USER_ID;
    resetRuntimeRepositoriesForTests();
    resetRuntimeDenominatorFilterRepositoryForTests();

    const response = await PUT(new Request(`http://localhost/api/filters/denominator/${appId}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adoptionLevel: "Engagement",
        revenueMetric: "ETD_ANSRAmt",
        numeratorSource: "API"
      })
    }), { params: Promise.resolve({ appId }) });

    expect(response.status).toBe(401);
  });
});
