import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/numerator/route";
import { resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";
import {
  listInMemoryStagedRowsForTests,
  resetNumeratorIngestionRepositoryForTests
} from "@/infrastructure/persistence/runtime/repositories";

describe("numerator ingestion integration - success", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
    resetNumeratorIngestionRepositoryForTests();
  });

  it("creates a staged row with actor metadata", async () => {
    const response = await POST(new Request("http://localhost/api/numerator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicationId: "10000000-0000-0000-0000-000000000003",
        payload: [{ clientId: "C-1", inProdigy: true }]
      })
    }));

    expect(response.status).toBe(201);

    const rows = listInMemoryStagedRowsForTests();
    expect(rows.length).toBe(1);
    expect(rows[0].applicationId).toBe("10000000-0000-0000-0000-000000000003");
    expect(rows[0].createdBy).toBe("30000000-0000-0000-0000-000000000001");
    expect(rows[0].payloadJson).toContain("inProdigy");
  });
});
