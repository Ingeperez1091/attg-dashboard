import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/numerator/route";
import { resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";
import { resetNumeratorIngestionRepositoryForTests } from "@/infrastructure/persistence/runtime/repositories";

describe("numerator ingestion contract - non-blocking", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
    resetNumeratorIngestionRepositoryForTests();
  });

  it("returns promptly without downstream dependency", async () => {
    const start = Date.now();

    const response = await POST(new Request("http://localhost/api/numerator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicationId: "10000000-0000-0000-0000-000000000001",
        payload: [{ engagementId: "E-123" }]
      })
    }));

    const elapsedMs = Date.now() - start;

    expect(response.status).toBe(201);
    expect(elapsedMs).toBeLessThan(1000);
  });
});
