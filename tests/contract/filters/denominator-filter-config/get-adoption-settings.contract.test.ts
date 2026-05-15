import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/filters/denominator/[appId]/settings/route";
import {
  getRuntimeAdoptionSettingsRepository,
  resetRuntimeDenominatorFilterRepositoryForTests,
  resetRuntimeRepositoriesForTests
} from "@/infrastructure/persistence/runtime/repositories";

describe("contract - GET /api/filters/denominator/:appId/settings", () => {
  const appId = "10000000-0000-0000-0000-000000000001";

  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
    resetRuntimeDenominatorFilterRepositoryForTests();
  });

  it("returns 200 with adoption settings when settings exist", async () => {
    await getRuntimeAdoptionSettingsRepository().upsert(
      appId,
      { adoptionLevel: "Engagement", revenueMetric: "ETD_ANSRAmt", numeratorSource: "API" },
      "seed"
    );

    const response = await GET(new Request(`http://localhost/api/filters/denominator/${appId}/settings`, {
      method: "GET"
    }), { params: Promise.resolve({ appId }) });

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.applicationId).toBe(appId);
    expect(body.adoptionLevel).toBe("Engagement");
    expect(body.revenueMetric).toBe("ETD_ANSRAmt");
    expect(body.numeratorSource).toBe("API");
  });

  it("returns 200 with null defaults when no settings exist", async () => {
    const response = await GET(new Request(`http://localhost/api/filters/denominator/${appId}/settings`, {
      method: "GET"
    }), { params: Promise.resolve({ appId }) });

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.applicationId).toBe(appId);
    expect(body.adoptionLevel).toBeNull();
    expect(body.revenueMetric).toBeNull();
    expect(body.numeratorSource).toBeNull();
  });

  it("returns 401 when no session is present", async () => {
    delete process.env.DEV_SESSION_USER_ID;
    resetRuntimeRepositoriesForTests();
    resetRuntimeDenominatorFilterRepositoryForTests();

    const response = await GET(new Request(`http://localhost/api/filters/denominator/${appId}/settings`, {
      method: "GET"
    }), { params: Promise.resolve({ appId }) });

    expect(response.status).toBe(401);
  });
});
