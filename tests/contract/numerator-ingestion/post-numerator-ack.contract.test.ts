import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/numerator/route";
import { resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";
import { resetNumeratorIngestionRepositoryForTests } from "@/infrastructure/persistence/runtime/repositories";

describe("numerator ingestion contract - acknowledgment", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
    resetNumeratorIngestionRepositoryForTests();
  });

  it("returns expected acknowledgment fields", async () => {
    const response = await POST(new Request("http://localhost/api/numerator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicationId: "10000000-0000-0000-0000-000000000002",
        payload: [{ clientId: "C-1" }]
      })
    }));

    const body = await response.json();

    expect(response.status).toBe(201);
    expect(typeof body.ingestionId).toBe("string");
    expect(body.applicationId).toBe("10000000-0000-0000-0000-000000000002");
    expect(typeof body.submittedAt).toBe("string");
    expect(body.status).toBe("staged");
  });
});
