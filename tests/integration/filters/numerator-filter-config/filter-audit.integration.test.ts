import { beforeEach, describe, expect, it } from "vitest";
import { PUT } from "@/app/api/filters/numerator/[appId]/route";
import { resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";
import { resetRuntimeNumeratorFilterRepositoryForTests } from "@/infrastructure/persistence/runtime/repositories";

describe("integration - numerator filter audit", () => {
  const appId = "10000000-0000-0000-0000-000000000005";
  const actorUserId = "30000000-0000-0000-0000-000000000001";

  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = actorUserId;
    resetRuntimeRepositoriesForTests();
    resetRuntimeNumeratorFilterRepositoryForTests();
  });

  it("returns createdBy and updatedBy in active ruleset response", async () => {
    const response = await PUT(new Request(`http://localhost/api/filters/numerator/${appId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rules: [
          {
            applicationModelFieldId: "40000000-0000-0000-0505-000000000005",
            operator: "GREATER_OR_EQUAL",
            value: "50000"
          }
        ]
      })
    }), { params: Promise.resolve({ appId }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.lastUpdatedBy).toBe(actorUserId);
    expect(body.rules[0].createdBy).toBe(actorUserId);
    expect(body.rules[0].updatedBy).toBe(actorUserId);
  });
});

