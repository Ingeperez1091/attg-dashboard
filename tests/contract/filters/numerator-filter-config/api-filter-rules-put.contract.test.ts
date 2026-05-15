import { beforeEach, describe, expect, it } from "vitest";
import { GET, PUT } from "@/app/api/filters/numerator/[appId]/route";
import { resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";
import { resetRuntimeNumeratorFilterRepositoryForTests } from "@/infrastructure/persistence/runtime/repositories";

describe("contract - PUT /api/filters/numerator/:appId", () => {
  const appId = "10000000-0000-0000-0000-000000000005";

  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
    resetRuntimeNumeratorFilterRepositoryForTests();
  });

  it("returns 400 with INVALID_REQUEST_BODY for malformed payload", async () => {
    const response = await PUT(new Request(`http://localhost/api/filters/numerator/${appId}`, {
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
    const seedResponse = await PUT(new Request(`http://localhost/api/filters/numerator/${appId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rules: [
          {
            applicationModelFieldId: "40000000-0000-0000-0505-000000000005",
            operator: "GREATER_THAN",
            value: "50000"
          }
        ]
      })
    }), { params: Promise.resolve({ appId }) });
    expect(seedResponse.status).toBe(200);

    const invalidResponse = await PUT(new Request(`http://localhost/api/filters/numerator/${appId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rules: [
          {
            applicationModelFieldId: "40000000-0000-0000-0507-000000000005",
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

    const getResponse = await GET(new Request(`http://localhost/api/filters/numerator/${appId}`, { method: "GET" }), {
      params: Promise.resolve({ appId })
    });
    const getBody = await getResponse.json();

    expect(getResponse.status).toBe(200);
    expect(getBody.rules).toHaveLength(1);
    expect(getBody.rules[0].applicationModelFieldId).toBe("40000000-0000-0000-0505-000000000005");
  });

  it("returns 400 with INVALID_REQUEST_BODY when IN_LIST value is not semicolon-separated", async () => {
    const response = await PUT(new Request(`http://localhost/api/filters/numerator/${appId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rules: [
          {
            applicationModelFieldId: "40000000-0000-0000-0505-000000000005",
            operator: "IN_LIST",
            value: "singleValue"
          }
        ]
      })
    }), { params: Promise.resolve({ appId }) });

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("VALIDATION_ERROR");
    expect(body.details.code).toBe("INVALID_REQUEST_BODY");
  });

  it("returns 400 VALIDATION_ERROR when a boolean field receives a non-boolean value", async () => {
    const maestroAppId = "10000000-0000-0000-0000-000000000001";
    const inMaestroFieldId = "40000000-0000-0000-0105-000000000001";

    const response = await PUT(new Request(`http://localhost/api/filters/numerator/${maestroAppId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rules: [
          {
            applicationModelFieldId: inMaestroFieldId,
            operator: "EQUALS",
            value: "yes"
          }
        ]
      })
    }), { params: Promise.resolve({ appId: maestroAppId }) });

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("VALIDATION_ERROR");
    expect(body.message).toContain("true");
    expect(body.message).toContain("false");
  });

  it("accepts 'true' and 'false' as valid values for a boolean field", async () => {
    const maestroAppId = "10000000-0000-0000-0000-000000000001";
    const inMaestroFieldId = "40000000-0000-0000-0105-000000000001";

    const response = await PUT(new Request(`http://localhost/api/filters/numerator/${maestroAppId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rules: [
          {
            applicationModelFieldId: inMaestroFieldId,
            operator: "EQUALS",
            value: "true"
          }
        ]
      })
    }), { params: Promise.resolve({ appId: maestroAppId }) });

    expect(response.status).toBe(200);
  });

  it("returns 400 VALIDATION_ERROR when a numeric field receives a non-numeric value", async () => {
    const response = await PUT(new Request(`http://localhost/api/filters/numerator/${appId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rules: [
          {
            applicationModelFieldId: "40000000-0000-0000-0505-000000000005",
            operator: "GREATER_THAN",
            value: "notanumber"
          }
        ]
      })
    }), { params: Promise.resolve({ appId }) });

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("VALIDATION_ERROR");
    expect(body.message).toContain("numeric");
  });

  it("accepts integers and decimals as valid values for a numeric field", async () => {
    const response = await PUT(new Request(`http://localhost/api/filters/numerator/${appId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rules: [
          {
            applicationModelFieldId: "40000000-0000-0000-0505-000000000005",
            operator: "GREATER_THAN",
            value: "99.5"
          }
        ]
      })
    }), { params: Promise.resolve({ appId }) });

    expect(response.status).toBe(200);
  });

  it("returns 400 VALIDATION_ERROR when a date field receives a non-SQL date format", async () => {
    const response = await PUT(new Request(`http://localhost/api/filters/numerator/${appId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rules: [
          {
            applicationModelFieldId: "40000000-0000-0000-0508-000000000005",
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

  it("accepts SQL date format YYYY-MM-DD for a date field", async () => {
    const response = await PUT(new Request(`http://localhost/api/filters/numerator/${appId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rules: [
          {
            applicationModelFieldId: "40000000-0000-0000-0508-000000000005",
            operator: "LESS_OR_EQUAL",
            value: "2026-05-07"
          }
        ]
      })
    }), { params: Promise.resolve({ appId }) });

    expect(response.status).toBe(200);
  });
});

