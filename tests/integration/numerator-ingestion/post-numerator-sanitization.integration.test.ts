import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/numerator/route";
import { resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";
import {
  listInMemoryStagedRowsForTests,
  resetNumeratorIngestionRepositoryForTests
} from "@/infrastructure/persistence/runtime/repositories";

describe("numerator ingestion integration - sanitization", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
    resetNumeratorIngestionRepositoryForTests();
  });

  it("stores SQL-like strings as inert data", async () => {
    const response = await POST(new Request("http://localhost/api/numerator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicationId: "10000000-0000-0000-0000-000000000001",
        payload: [{ note: "' OR 1=1 --" }]
      })
    }));

    expect(response.status).toBe(201);
    const [row] = listInMemoryStagedRowsForTests();
    expect(row.payloadJson).toContain("' OR 1=1 --");
  });
});
