import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/numerator/route";
import { resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";
import { resetNumeratorIngestionRepositoryForTests } from "@/infrastructure/persistence/runtime/repositories";

describe("numerator ingestion contract - sanitization", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
    resetNumeratorIngestionRepositoryForTests();
  });

  it("accepts SQL-like string content as data", async () => {
    const response = await POST(new Request("http://localhost/api/numerator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicationId: "10000000-0000-0000-0000-000000000001",
        payload: [{ name: "'; DROP TABLE app.Users; --" }]
      })
    }));

    expect(response.status).toBe(201);
  });

  it("rejects unsafe prototype-pollution keys", async () => {
    const response = await POST(new Request("http://localhost/api/numerator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body:
        '{"applicationId":"10000000-0000-0000-0000-000000000001","payload":{"__proto__":{"polluted":true}}}'
    }));

    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toBe("VALIDATION_ERROR");
  });
});
