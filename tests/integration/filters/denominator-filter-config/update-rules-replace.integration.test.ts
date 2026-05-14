import { beforeEach, describe, expect, it } from "vitest";
import { GET, PUT } from "@/app/api/filters/denominator/[appId]/route";
import {
  resetRuntimeDenominatorFilterRepositoryForTests,
  resetRuntimeRepositoriesForTests
} from "@/infrastructure/persistence/runtime/repositories";

describe("integration - denominator rule replacement", () => {
  const appId = "10000000-0000-0000-0000-000000000001";

  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
    resetRuntimeDenominatorFilterRepositoryForTests();
  });

  it("replaces existing rules on subsequent PUT", async () => {
    const firstPut = await PUT(new Request(`http://localhost/api/filters/denominator/${appId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rules: [
          {
            denominatorModelId: "50000000-0000-0000-0007-000000000000",
            operator: "EQUALS",
            value: "11420"
          }
        ]
      })
    }), { params: Promise.resolve({ appId }) });

    expect(firstPut.status).toBe(200);

    const secondPut = await PUT(new Request(`http://localhost/api/filters/denominator/${appId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rules: [
          {
            denominatorModelId: "50000000-0000-0000-0009-000000000000",
            operator: "NOT_EQUALS",
            value: "Closed"
          }
        ]
      })
    }), { params: Promise.resolve({ appId }) });

    const secondBody = await secondPut.json();

    expect(secondPut.status).toBe(200);
    expect(secondBody.rules).toHaveLength(1);
    expect(secondBody.rules[0].denominatorModelId).toBe("50000000-0000-0000-0009-000000000000");
    expect(secondBody.rules[0].operator).toBe("NOT_EQUALS");

    const getResponse = await GET(new Request(`http://localhost/api/filters/denominator/${appId}`, {
      method: "GET"
    }), { params: Promise.resolve({ appId }) });

    const getBody = await getResponse.json();

    expect(getResponse.status).toBe(200);
    expect(getBody.rules).toHaveLength(1);
    expect(getBody.rules[0].denominatorModelId).toBe("50000000-0000-0000-0009-000000000000");
    expect(getBody.rules[0].value).toBe("Closed");
  });
});
