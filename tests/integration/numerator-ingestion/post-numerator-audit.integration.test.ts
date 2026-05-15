import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/numerator/route";
import { resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";
import {
  listInMemoryStagedRowsForTests,
  resetNumeratorIngestionRepositoryForTests
} from "@/infrastructure/persistence/runtime/repositories";

describe("numerator ingestion integration - audit", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
    resetNumeratorIngestionRepositoryForTests();
  });

  it("persists CreatedBy and CreateDate for accepted intake", async () => {
    await POST(new Request("http://localhost/api/numerator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicationId: "10000000-0000-0000-0000-000000000004",
        payload: [{ engagementId: "E-444" }]
      })
    }));

    const [row] = listInMemoryStagedRowsForTests();

    expect(row.createdBy).toBe("30000000-0000-0000-0000-000000000001");
    expect(new Date(row.createDate).toString()).not.toBe("Invalid Date");
  });
});
