import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/numerator/route";
import { resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";
import {
  listInMemoryStagedRowsForTests,
  resetNumeratorIngestionRepositoryForTests
} from "@/infrastructure/persistence/runtime/repositories";

const APP_IDS = [
  "10000000-0000-0000-0000-000000000001",
  "10000000-0000-0000-0000-000000000002",
  "10000000-0000-0000-0000-000000000003",
  "10000000-0000-0000-0000-000000000004",
  "10000000-0000-0000-0000-000000000005"
];

describe("numerator ingestion integration - five applications", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
    resetNumeratorIngestionRepositoryForTests();
  });

  it("accepts submissions for all in-scope applications", async () => {
    for (const applicationId of APP_IDS) {
      const response = await POST(new Request("http://localhost/api/numerator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId,
          payload: [{ marker: applicationId }]
        })
      }));

      expect(response.status).toBe(201);
    }

    const rows = listInMemoryStagedRowsForTests();
    expect(rows.length).toBe(5);
  });
});
