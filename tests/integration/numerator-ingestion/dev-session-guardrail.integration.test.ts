import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/numerator/route";
import { clearDevSessionForBaselineTests } from "./setup";
import { resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";
import { resetNumeratorIngestionRepositoryForTests } from "@/infrastructure/persistence/runtime/repositories";

describe("numerator ingestion integration - DEV session guardrail", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    clearDevSessionForBaselineTests();
    resetRuntimeRepositoriesForTests();
    resetNumeratorIngestionRepositoryForTests();
  });

  it("returns 401 when no auth context exists", async () => {
    const response = await POST(new Request("http://localhost/api/numerator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicationId: "10000000-0000-0000-0000-000000000001",
        payload: [{ e: 1 }]
      })
    }));

    expect(response.status).toBe(401);
  });
});
