import { beforeEach, describe, expect, it } from "vitest";
import { GET, PUT } from "@/app/api/filters/denominator/[appId]/route";
import {
  resetRuntimeDenominatorFilterRepositoryForTests,
  resetRuntimeRepositoriesForTests
} from "@/infrastructure/persistence/runtime/repositories";

describe("contract - PUT /api/filters/denominator/:appId validation", () => {
  const appId = "10000000-0000-0000-0000-000000000001";

  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
    resetRuntimeDenominatorFilterRepositoryForTests();
  });

  it("returns 400 with INVALID_REQUEST_BODY for malformed payload", async () => {
    const response = await PUT(new Request(`http://localhost/api/filters/denominator/${appId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rules: [{ operator: "EQUALS" }] })
    }), { params: Promise.resolve({ appId }) });

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("VALIDATION_ERROR");
    expect(body.details.code).toBe("INVALID_REQUEST_BODY");
  });

  it("returns 400 FIELD_NOT_FILTERABLE and keeps prior rules unchanged", async () => {
    const seedResponse = await PUT(new Request(`http://localhost/api/filters/denominator/${appId}`, {
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
    }), { params: Promise.resolve({ appId }) });

    expect(seedResponse.status).toBe(200);

    const invalidResponse = await PUT(new Request(`http://localhost/api/filters/denominator/${appId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rules: [
          {
            denominatorModelId: "50000000-0000-0000-0001-000000000000",
            operator: "EQUALS",
            value: "blocked"
          }
        ]
      })
    }), { params: Promise.resolve({ appId }) });

    const invalidBody = await invalidResponse.json();

    expect(invalidResponse.status).toBe(400);
    expect(invalidBody.error).toBe("VALIDATION_ERROR");
    expect(invalidBody.details.code).toBe("FIELD_NOT_FILTERABLE");

    const getResponse = await GET(new Request(`http://localhost/api/filters/denominator/${appId}`, {
      method: "GET"
    }), { params: Promise.resolve({ appId }) });
    const getBody = await getResponse.json();

    expect(getResponse.status).toBe(200);
    expect(getBody.rules).toHaveLength(1);
    expect(getBody.rules[0].denominatorModelId).toBe("50000000-0000-0000-0007-000000000000");
    expect(getBody.rules[0].value).toBe("11300");
  });

  it("returns 400 when IN_LIST value is not semicolon separated", async () => {
    const response = await PUT(new Request(`http://localhost/api/filters/denominator/${appId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rules: [
          {
            denominatorModelId: "50000000-0000-0000-0007-000000000000",
            operator: "IN_LIST",
            value: "single"
          }
        ]
      })
    }), { params: Promise.resolve({ appId }) });

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("VALIDATION_ERROR");
    expect(body.details.code).toBe("INVALID_REQUEST_BODY");
  });

  it("returns 400 VALIDATION_ERROR when date field value is not SQL format YYYY-MM-DD", async () => {
    const response = await PUT(new Request(`http://localhost/api/filters/denominator/${appId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rules: [
          {
            denominatorModelId: "50000000-0000-0000-000A-000000000000",
            operator: "GREATER_THAN",
            value: "05/07/2026"
          }
        ]
      })
    }), { params: Promise.resolve({ appId }) });

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("VALIDATION_ERROR");
    expect(body.message).toContain("YYYY-MM-DD");
  });

  it("accepts SQL date format YYYY-MM-DD for date denominator fields", async () => {
    const response = await PUT(new Request(`http://localhost/api/filters/denominator/${appId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rules: [
          {
            denominatorModelId: "50000000-0000-0000-000A-000000000000",
            operator: "GREATER_OR_EQUAL",
            value: "2026-05-07"
          }
        ]
      })
    }), { params: Promise.resolve({ appId }) });

    expect(response.status).toBe(200);
  });
});
