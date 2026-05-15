import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/pipeline/run/route";
import { getRuntimeValidationPipelineRepository, resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";

describe("validation pipeline contract - denominator status propagation", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
  });

  it("returns 409 when a queued/processing run already exists for the application", async () => {
    const repository = getRuntimeValidationPipelineRepository();
    await repository.createRun({
      runId: "70000000-0000-0000-0000-000000000021",
      applicationId: "10000000-0000-0000-0000-000000000001",
      triggerSource: "API",
      actorUserId: "30000000-0000-0000-0000-000000000001"
    });

    const response = await POST(new Request("http://localhost/api/pipeline/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicationId: "10000000-0000-0000-0000-000000000001",
        triggerSource: "API"
      })
    }));

    const body = await response.json();
    expect(response.status).toBe(409);
    expect(body.error).toBe("CONFLICT");
  });

  it("returns 404 when application is missing or inactive", async () => {
    const response = await POST(new Request("http://localhost/api/pipeline/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicationId: "10000000-0000-0000-0000-000000009999",
        triggerSource: "API"
      })
    }));

    const body = await response.json();
    expect(response.status).toBe(404);
    expect(body.error).toBe("NOT_FOUND");
  });
});
