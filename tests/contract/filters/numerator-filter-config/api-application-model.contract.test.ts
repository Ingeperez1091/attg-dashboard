import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/applications/[appId]/numeratormodel/route";
import { resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";
import { resetRuntimeNumeratorFilterRepositoryForTests } from "@/infrastructure/persistence/runtime/repositories";

describe("contract - GET /api/applications/:appId/numeratormodel", () => {
  const appId = "10000000-0000-0000-0000-000000000005";

  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
    resetRuntimeNumeratorFilterRepositoryForTests();
  });

  it("returns all active fields, including non-filterable ones", async () => {
    const response = await GET(new Request(`http://localhost/api/applications/${appId}/numeratormodel`, {
      method: "GET"
    }), { params: Promise.resolve({ appId }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.applicationId).toBe(appId);
    expect(Array.isArray(body.fields)).toBe(true);

    const notesField = body.fields.find((field: { fieldName: string }) => field.fieldName === "Notes");
    expect(notesField).toBeDefined();
    expect(notesField.isFilterable).toBe(false);

    const revenueField = body.fields.find((field: { fieldName: string }) => field.fieldName === "RevenueFYTD");
    expect(revenueField).toBeDefined();
    expect(revenueField.isFilterable).toBe(true);
  });
});

