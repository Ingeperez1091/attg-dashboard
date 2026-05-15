import { beforeEach, describe, expect, it } from "vitest";
import { GET, PUT } from "@/app/api/filters/numerator/[appId]/route";
import { resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";
import { resetRuntimeNumeratorFilterRepositoryForTests } from "@/infrastructure/persistence/runtime/repositories";

describe("integration - numerator filter CRUD", () => {
  const appId = "10000000-0000-0000-0000-000000000005";

  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
    resetRuntimeNumeratorFilterRepositoryForTests();
  });

  it("replaces rule set on subsequent PUT and returns only active replacement", async () => {
    const firstPut = await PUT(new Request(`http://localhost/api/filters/numerator/${appId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rules: [
          {
            applicationModelFieldId: "40000000-0000-0000-0505-000000000005",
            operator: "GREATER_THAN",
            value: "10000"
          }
        ]
      })
    }), { params: Promise.resolve({ appId }) });
    expect(firstPut.status).toBe(200);

    const secondPut = await PUT(new Request(`http://localhost/api/filters/numerator/${appId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rules: [
          {
            applicationModelFieldId: "40000000-0000-0000-0505-000000000005",
            operator: "LESS_THAN",
            value: "20000"
          }
        ]
      })
    }), { params: Promise.resolve({ appId }) });
    const secondBody = await secondPut.json();

    expect(secondPut.status).toBe(200);
    expect(secondBody.rules).toHaveLength(1);
    expect(secondBody.rules[0].operator).toBe("LESS_THAN");
    expect(secondBody.rules[0].value).toBe("20000");

    const getResponse = await GET(new Request(`http://localhost/api/filters/numerator/${appId}`, {
      method: "GET"
    }), { params: Promise.resolve({ appId }) });
    const getBody = await getResponse.json();

    expect(getResponse.status).toBe(200);
    expect(getBody.rules).toHaveLength(1);
    expect(getBody.rules[0].operator).toBe("LESS_THAN");
  });
});

