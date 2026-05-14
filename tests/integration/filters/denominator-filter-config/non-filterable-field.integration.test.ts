import { beforeEach, describe, expect, it } from "vitest";
import { GET, PUT } from "@/app/api/filters/denominator/[appId]/route";
import {
  resetRuntimeDenominatorFilterRepositoryForTests,
  resetRuntimeRepositoriesForTests
} from "@/infrastructure/persistence/runtime/repositories";

describe("integration - non-filterable field rejection", () => {
  const appId = "10000000-0000-0000-0000-000000000001";

  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
    resetRuntimeDenominatorFilterRepositoryForTests();
  });

  it.each([
    ["EngagementID (text)", "50000000-0000-0000-0001-000000000000", "EQUALS", "ENG001"],
    ["ClientID (text)", "50000000-0000-0000-0003-000000000000", "EQUALS", "C001"],
    ["EngagementService (text)", "50000000-0000-0000-0008-000000000000", "EQUALS", "Advisory"],
    ["ETD_ChargedHours (numeric)", "50000000-0000-0000-0010-000000000000", "GREATER_THAN", "100"],
    ["FYTD_ChargedHours (numeric)", "50000000-0000-0000-0011-000000000000", "LESS_THAN", "200"]
  ])("returns 400 FIELD_NOT_FILTERABLE for non-filterable field: %s", async (_label, denominatorModelId, operator, value) => {
    const response = await PUT(
      new Request(`http://localhost/api/filters/denominator/${appId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: [{ denominatorModelId, operator, value }] })
      }),
      { params: Promise.resolve({ appId }) }
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("VALIDATION_ERROR");
    expect(body.details.code).toBe("FIELD_NOT_FILTERABLE");
  });

  it("preserves existing rules when a non-filterable field is submitted", async () => {
    // Seed with a valid filterable rule first
    const seedResponse = await PUT(
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

    expect(seedResponse.status).toBe(200);

    // Attempt to replace with a non-filterable field
    const rejectResponse = await PUT(
      new Request(`http://localhost/api/filters/denominator/${appId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rules: [
            {
              denominatorModelId: "50000000-0000-0000-0010-000000000000",
              operator: "GREATER_THAN",
              value: "100"
            }
          ]
        })
      }),
      { params: Promise.resolve({ appId }) }
    );

    expect(rejectResponse.status).toBe(400);

    // Verify original rules are unchanged
    const getResponse = await GET(
      new Request(`http://localhost/api/filters/denominator/${appId}`, {
        method: "GET"
      }),
      { params: Promise.resolve({ appId }) }
    );

    const getBody = await getResponse.json();

    expect(getResponse.status).toBe(200);
    expect(getBody.rules).toHaveLength(1);
    expect(getBody.rules[0].denominatorModelId).toBe("50000000-0000-0000-0007-000000000000");
    expect(getBody.rules[0].value).toBe("11300");
  });

  it("accepts a mix of valid filterable fields", async () => {
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
            },
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
});
