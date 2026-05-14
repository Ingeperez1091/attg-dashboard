import { beforeEach, describe, expect, it } from "vitest";
import { GET, PUT } from "@/app/api/filters/denominator/[appId]/route";
import {
  resetRuntimeDenominatorFilterRepositoryForTests,
  resetRuntimeRepositoriesForTests
} from "@/infrastructure/persistence/runtime/repositories";

describe("contract - PUT /api/filters/denominator/:appId", () => {
  const appId = "10000000-0000-0000-0000-000000000001";

  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
    resetRuntimeDenominatorFilterRepositoryForTests();
  });

  it("replaces ruleset and returns the updated rules", async () => {
    const response = await PUT(new Request(`http://localhost/api/filters/denominator/${appId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rules: [
          {
            denominatorModelId: "50000000-0000-0000-0007-000000000000",
            operator: "EQUALS",
            value: "11300"
          },
          {
            denominatorModelId: "50000000-0000-0000-000C-000000000000",
            operator: "GREATER_THAN",
            value: "5000"
          }
        ]
      })
    }), { params: Promise.resolve({ appId }) });

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.applicationId).toBe(appId);
    expect(Array.isArray(body.rules)).toBe(true);
    expect(body.rules).toHaveLength(2);
    expect(body.rules[0].ruleOrder).toBe(1);
    expect(body.rules[1].ruleOrder).toBe(2);
    expect(body.lastUpdatedAt).toBeTruthy();

    const getResponse = await GET(new Request(`http://localhost/api/filters/denominator/${appId}`, {
      method: "GET"
    }), { params: Promise.resolve({ appId }) });
    const getBody = await getResponse.json();

    expect(getResponse.status).toBe(200);
    expect(getBody.rules).toHaveLength(2);
    expect(getBody.rules[0].value).toBe("11300");
    expect(getBody.rules[1].operator).toBe("GREATER_THAN");
  });
});
