import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/filters/denominator/[appId]/route";
import {
  resetRuntimeDenominatorFilterRepositoryForTests,
  resetRuntimeRepositoriesForTests
} from "@/infrastructure/persistence/runtime/repositories";

describe("contract - GET /api/filters/denominator/:appId", () => {
  const appId = "10000000-0000-0000-0000-000000000001";
  const emptyAppId = "10000000-0000-0000-0000-000000000002";

  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
    resetRuntimeDenominatorFilterRepositoryForTests();
  });

  it("returns scoped denominator rules payload", async () => {
    const response = await GET(new Request(`http://localhost/api/filters/denominator/${appId}`, {
      method: "GET"
    }), { params: Promise.resolve({ appId }) });

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.applicationId).toBe(appId);
    expect(Array.isArray(body.rules)).toBe(true);
    expect(body.rules.length).toBeGreaterThan(0);
  });

  it("returns an empty ruleset for a known application without saved denominator rules", async () => {
    const response = await GET(new Request(`http://localhost/api/filters/denominator/${emptyAppId}`, {
      method: "GET"
    }), { params: Promise.resolve({ appId: emptyAppId }) });

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.applicationId).toBe(emptyAppId);
    expect(body.applicationName).toBe("EYST");
    expect(body.rules).toEqual([]);
    expect(body.lastUpdatedAt).toBeNull();
    expect(body.lastUpdatedBy).toBeNull();
  });
});
