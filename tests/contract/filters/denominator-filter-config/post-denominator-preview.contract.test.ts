import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/filters/denominator/[appId]/preview/route";
import {
  resetRuntimeDenominatorFilterRepositoryForTests,
  resetRuntimeRepositoriesForTests
} from "@/infrastructure/persistence/runtime/repositories";

describe("contract - POST /api/filters/denominator/:appId/preview", () => {
  const appId = "10000000-0000-0000-0000-000000000001";

  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
    resetRuntimeDenominatorFilterRepositoryForTests();
  });

  it("returns preview payload with current, projected, delta, and calculatedAtUtc", async () => {
    const response = await POST(new Request(`http://localhost/api/filters/denominator/${appId}/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rules: [
          {
            denominatorModelId: "50000000-0000-0000-0007-000000000000",
            operator: "EQUALS",
            value: "11420"
          },
          {
            denominatorModelId: "50000000-0000-0000-000C-000000000000",
            operator: "GREATER_THAN",
            value: "1000"
          }
        ]
      })
    }), { params: Promise.resolve({ appId }) });

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.applicationId).toBe(appId);
    expect(body.current).toBeDefined();
    expect(body.projected).toBeDefined();
    expect(body.delta).toBeDefined();
    expect(typeof body.current.count).toBe("number");
    expect(typeof body.projected.revenue).toBe("number");
    expect(typeof body.calculatedAtUtc).toBe("string");
  });

  it("returns 400 for invalid preview payload", async () => {
    const response = await POST(new Request(`http://localhost/api/filters/denominator/${appId}/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rules: [
          {
            operator: "EQUALS",
            value: "11420"
          }
        ]
      })
    }), { params: Promise.resolve({ appId }) });

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("VALIDATION_ERROR");
    expect(body.details.code).toBe("INVALID_REQUEST_BODY");
  });
});
