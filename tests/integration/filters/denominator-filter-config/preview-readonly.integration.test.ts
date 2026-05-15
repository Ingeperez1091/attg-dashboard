import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/filters/denominator/[appId]/route";
import { POST } from "@/app/api/filters/denominator/[appId]/preview/route";
import {
  resetRuntimeDenominatorFilterRepositoryForTests,
  resetRuntimeRepositoriesForTests
} from "@/infrastructure/persistence/runtime/repositories";

describe("integration - denominator preview is non-persistent", () => {
  const appId = "10000000-0000-0000-0000-000000000001";

  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
    resetRuntimeDenominatorFilterRepositoryForTests();
  });

  it("does not mutate persisted rules when preview is executed", async () => {
    const beforeResponse = await GET(new Request(`http://localhost/api/filters/denominator/${appId}`, {
      method: "GET"
    }), { params: Promise.resolve({ appId }) });

    const beforeBody = await beforeResponse.json();
    expect(beforeResponse.status).toBe(200);

    const previewResponse = await POST(new Request(`http://localhost/api/filters/denominator/${appId}/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rules: [
          {
            denominatorModelId: "50000000-0000-0000-0009-000000000000",
            operator: "NOT_EQUALS",
            value: "Closed"
          },
          {
            denominatorModelId: "50000000-0000-0000-000C-000000000000",
            operator: "GREATER_THAN",
            value: "100000"
          }
        ]
      })
    }), { params: Promise.resolve({ appId }) });

    expect(previewResponse.status).toBe(200);

    const afterResponse = await GET(new Request(`http://localhost/api/filters/denominator/${appId}`, {
      method: "GET"
    }), { params: Promise.resolve({ appId }) });
    const afterBody = await afterResponse.json();

    expect(afterResponse.status).toBe(200);
    expect(afterBody.rules).toEqual(beforeBody.rules);
  });
});
