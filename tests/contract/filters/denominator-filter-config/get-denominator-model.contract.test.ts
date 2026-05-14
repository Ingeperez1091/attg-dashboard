import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/denomindator-model/route";
import {
  resetRuntimeDenominatorFilterRepositoryForTests,
  resetRuntimeRepositoriesForTests
} from "@/infrastructure/persistence/runtime/repositories";

describe("contract - GET /api/denomindator-model", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
    resetRuntimeDenominatorFilterRepositoryForTests();
  });

  it("returns 200 with denominator model fields", async () => {
    const response = await GET(new Request("http://localhost/api/denomindator-model", {
      method: "GET"
    }));

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(Array.isArray(body.fields)).toBe(true);
    expect(body.fields.length).toBeGreaterThan(0);
  });
});
