import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/numerator/route";
import { resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";
import {
  listInMemoryStagedRowsForTests,
  resetNumeratorIngestionRepositoryForTests
} from "@/infrastructure/persistence/runtime/repositories";

describe("numerator ingestion integration - duplicate traceability", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
    resetNumeratorIngestionRepositoryForTests();
  });

  it("creates distinct staged records for duplicate payload submissions", async () => {
    const payload = {
      applicationId: "10000000-0000-0000-0000-000000000001",
      payload: [{ engagementId: "E-dup" }]
    };

    const response1 = await POST(new Request("http://localhost/api/numerator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }));

    const response2 = await POST(new Request("http://localhost/api/numerator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }));

    expect(response1.status).toBe(201);
    expect(response2.status).toBe(201);

    const rows = listInMemoryStagedRowsForTests();
    expect(rows.length).toBe(2);
    expect(rows[0].stageId).not.toBe(rows[1].stageId);
  });
});
