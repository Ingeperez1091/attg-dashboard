import { beforeEach, describe, expect, it } from "vitest";
import { GET as getModel } from "@/app/api/applications/[appId]/numeratormodel/route";
import { PUT } from "@/app/api/filters/numerator/[appId]/route";
import { resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";
import { resetRuntimeNumeratorFilterRepositoryForTests } from "@/infrastructure/persistence/runtime/repositories";

describe("integration - numerator filter editor UI", () => {
  const appId = "10000000-0000-0000-0000-000000000005";
  const actorUserId = "30000000-0000-0000-0000-000000000001";

  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = actorUserId;
    resetRuntimeRepositoriesForTests();
    resetRuntimeNumeratorFilterRepositoryForTests();
  });

  it("returns all active fields and includes non-filterable flags", async () => {
    const response = await getModel(new Request(`http://localhost/api/applications/${appId}/numeratormodel`, {
      method: "GET"
    }), { params: Promise.resolve({ appId }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.fields).toHaveLength(8);
    expect(body.fields.some((field: { isFilterable: boolean }) => field.isFilterable === false)).toBe(true);
  });

  it("rejects non-filterable field submissions with FIELD_NOT_FILTERABLE", async () => {
    const response = await PUT(new Request(`http://localhost/api/filters/numerator/${appId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rules: [
          {
            applicationModelFieldId: "40000000-0000-0000-0507-000000000005",
            operator: "EQUALS",
            value: "sensitive"
          }
        ]
      })
    }), { params: Promise.resolve({ appId }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.details.code).toBe("FIELD_NOT_FILTERABLE");
  });

  it("includes CreatedBy and UpdatedBy fields for active rules", async () => {
    const response = await PUT(new Request(`http://localhost/api/filters/numerator/${appId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rules: [
          {
            applicationModelFieldId: "40000000-0000-0000-0505-000000000005",
            operator: "GREATER_OR_EQUAL",
            value: "20000"
          }
        ]
      })
    }), { params: Promise.resolve({ appId }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.rules[0].createdBy).toBe(actorUserId);
    expect(body.rules[0].updatedBy).toBe(actorUserId);
  });
});

