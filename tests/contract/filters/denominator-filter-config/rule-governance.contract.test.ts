import { beforeEach, describe, expect, it } from "vitest";
import { PUT } from "@/app/api/filters/denominator/[appId]/route";
import {
  resetRuntimeDenominatorFilterRepositoryForTests,
  resetRuntimeRepositoriesForTests
} from "@/infrastructure/persistence/runtime/repositories";

describe("contract - PUT /api/filters/denominator/:appId field/operator governance", () => {
  const appId = "10000000-0000-0000-0000-000000000001";

  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
    resetRuntimeDenominatorFilterRepositoryForTests();
  });

  it("returns 400 VALIDATION_ERROR when a numeric-only operator is used on a text field", async () => {
    // EngagementServiceCode (0007) is a text field — GREATER_THAN is numeric-only
    const response = await PUT(
      new Request(`http://localhost/api/filters/denominator/${appId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rules: [
            {
              denominatorModelId: "50000000-0000-0000-0007-000000000000",
              operator: "GREATER_THAN",
              value: "11300"
            }
          ]
        })
      }),
      { params: Promise.resolve({ appId }) }
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR when a text-only operator is used on a numeric field", async () => {
    // ETD_ANSRAmt (000C) is a numeric field — CONTAINS is text-only
    const response = await PUT(
      new Request(`http://localhost/api/filters/denominator/${appId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rules: [
            {
              denominatorModelId: "50000000-0000-0000-000C-000000000000",
              operator: "CONTAINS",
              value: "5000"
            }
          ]
        })
      }),
      { params: Promise.resolve({ appId }) }
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR when a text-only operator is used on a date field", async () => {
    // CreationDate (000A) is a date field — IN_LIST is text-only
    const response = await PUT(
      new Request(`http://localhost/api/filters/denominator/${appId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rules: [
            {
              denominatorModelId: "50000000-0000-0000-000A-000000000000",
              operator: "IN_LIST",
              value: "2025-01-01;2025-12-31"
            }
          ]
        })
      }),
      { params: Promise.resolve({ appId }) }
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("VALIDATION_ERROR");
  });

  it("returns 200 for a valid text operator on a text field", async () => {
    const response = await PUT(
      new Request(`http://localhost/api/filters/denominator/${appId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rules: [
            {
              denominatorModelId: "50000000-0000-0000-0007-000000000000",
              operator: "EQUALS",
              value: "11300"
            }
          ]
        })
      }),
      { params: Promise.resolve({ appId }) }
    );

    expect(response.status).toBe(200);
  });

  it("returns 200 for a valid numeric operator on a numeric field", async () => {
    const response = await PUT(
      new Request(`http://localhost/api/filters/denominator/${appId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rules: [
            {
              denominatorModelId: "50000000-0000-0000-000C-000000000000",
              operator: "GREATER_THAN",
              value: "5000"
            }
          ]
        })
      }),
      { params: Promise.resolve({ appId }) }
    );

    expect(response.status).toBe(200);
  });

  it("returns 400 VALIDATION_ERROR when a non-numeric value is supplied for a numeric field", async () => {
    // ETD_ANSRAmt (000C) is numeric — passing text value should fail
    const response = await PUT(
      new Request(`http://localhost/api/filters/denominator/${appId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rules: [
            {
              denominatorModelId: "50000000-0000-0000-000C-000000000000",
              operator: "GREATER_THAN",
              value: "notanumber"
            }
          ]
        })
      }),
      { params: Promise.resolve({ appId }) }
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("VALIDATION_ERROR");
  });
});
