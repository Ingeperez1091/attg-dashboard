import { beforeEach, describe, expect, it } from "vitest";
import { PUT } from "@/app/api/filters/denominator/[appId]/route";
import {
  resetRuntimeRepositoriesForTests,
} from "@/infrastructure/persistence/runtime/repositories";

describe("contract - 409 Conflict on stale configVersion", () => {
  const appId = "10000000-0000-0000-0000-000000000001";

  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
  });

  function makePutRequest(body: object) {
    return new Request(`http://localhost/api/filters/denominator/${appId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  const validRules = [
    {
      denominatorModelId: "50000000-0000-0000-0007-000000000000",
      operator: "EQUALS",
      value: "11300",
    },
  ];

  it("returns 200 when configVersion matches current version", async () => {
    const response = await PUT(makePutRequest({
      rules: validRules,
      configVersion: 1,
    }), { params: Promise.resolve({ appId }) });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.configVersion).toBe(2);
  });

  it("returns 409 when configVersion is stale", async () => {
    // First save succeeds, increments version to 2
    const first = await PUT(makePutRequest({
      rules: validRules,
      configVersion: 1,
    }), { params: Promise.resolve({ appId }) });
    expect(first.status).toBe(200);

    // Second save with stale version 1 → 409
    const second = await PUT(makePutRequest({
      rules: validRules,
      configVersion: 1,
    }), { params: Promise.resolve({ appId }) });

    expect(second.status).toBe(409);
    const body = await second.json();
    expect(body.error).toBe("VERSION_CONFLICT");
    expect(body.message).toContain("modified by another user");
    expect(body.details.currentVersion).toBe(2);
    expect(body.details.lastModifiedBy).toBeDefined();
    expect(body.details.lastModifiedAt).toBeDefined();
    expect(Array.isArray(body.details.currentRules)).toBe(true);
  });

  it("returns 400 when configVersion is missing from request body", async () => {
    const response = await PUT(makePutRequest({
      rules: validRules,
      // configVersion intentionally omitted
    }), { params: Promise.resolve({ appId }) });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("VALIDATION_ERROR");
    expect(body.details.code).toBe("MISSING_CONFIG_VERSION");
  });

  it("returns 200 on second save when configVersion is current", async () => {
    // First save: version 1 → 2
    const first = await PUT(makePutRequest({
      rules: validRules,
      configVersion: 1,
    }), { params: Promise.resolve({ appId }) });
    expect(first.status).toBe(200);
    const firstBody = await first.json();
    expect(firstBody.configVersion).toBe(2);

    // Second save with correct version 2 → 3
    const second = await PUT(makePutRequest({
      rules: validRules,
      configVersion: 2,
    }), { params: Promise.resolve({ appId }) });
    expect(second.status).toBe(200);
    const secondBody = await second.json();
    expect(secondBody.configVersion).toBe(3);
  });
});
