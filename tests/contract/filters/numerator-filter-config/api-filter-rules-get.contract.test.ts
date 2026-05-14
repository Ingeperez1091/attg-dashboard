import { beforeEach, describe, expect, it } from "vitest";
import { GET, PUT } from "@/app/api/filters/numerator/[appId]/route";
import { resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";
import { resetRuntimeNumeratorFilterRepositoryForTests } from "@/infrastructure/persistence/runtime/repositories";

describe("contract - GET /api/filters/numerator/:appId", () => {
  const appId = "10000000-0000-0000-0000-000000000005";

  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
    resetRuntimeNumeratorFilterRepositoryForTests();
  });

  it("returns 401 when no session can be resolved", async () => {
    delete process.env.DEV_SESSION_USER_ID;

    const response = await GET(new Request(`http://localhost/api/filters/numerator/${appId}`, {
      method: "GET"
    }), { params: Promise.resolve({ appId }) });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 200 with an empty ruleset when no active rules exist for a valid application", async () => {
    const response = await GET(new Request(`http://localhost/api/filters/numerator/${appId}`, {
      method: "GET"
    }), { params: Promise.resolve({ appId }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.applicationId).toBe(appId);
    expect(body.applicationName).toBe("Navigate");
    expect(body.rules).toEqual([]);
    expect(body.lastUpdatedAt).toBeNull();
    expect(body.lastUpdatedBy).toBeNull();
  });

  it("returns 200 and rules payload after successful rule replacement", async () => {
    const putResponse = await PUT(new Request(`http://localhost/api/filters/numerator/${appId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rules: [
          {
            applicationModelFieldId: "40000000-0000-0000-0505-000000000005",
            operator: "GREATER_OR_EQUAL",
            value: "25000"
          }
        ]
      })
    }), { params: Promise.resolve({ appId }) });
    expect(putResponse.status).toBe(200);

    const response = await GET(new Request(`http://localhost/api/filters/numerator/${appId}`, {
      method: "GET"
    }), { params: Promise.resolve({ appId }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.applicationId).toBe(appId);
    expect(Array.isArray(body.rules)).toBe(true);
    expect(body.rules).toHaveLength(1);
    expect(body.rules[0].applicationModelFieldId).toBe("40000000-0000-0000-0505-000000000005");
    expect(body.rules[0].createdBy).toBe("30000000-0000-0000-0000-000000000001");
    expect(body.rules[0].updatedBy).toBe("30000000-0000-0000-0000-000000000001");
  });
});

