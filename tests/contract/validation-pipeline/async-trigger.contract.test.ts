import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/pipeline/run/route";
import { getRuntimeValidationPipelineRepository, resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";

describe("validation pipeline contract - async trigger and run lifecycle", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
  });

  it("returns 201 with Queued status immediately — run is not completed synchronously", async () => {
    const response = await POST(new Request("http://localhost/api/pipeline/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicationId: "10000000-0000-0000-0000-000000000001",
        triggerSource: "API"
      })
    }));

    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.status).toBe("Queued");
    expect(body.runId).toBeTruthy();
    // Async contract: caller receives immediate queued entry, not a completed result.
    expect(body.status).not.toBe("Completed");
    expect(body.status).not.toBe("Processing");
  });

  it("returns executionMode in response indicating dispatch mechanism", async () => {
    const response = await POST(new Request("http://localhost/api/pipeline/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicationId: "10000000-0000-0000-0000-000000000001",
        triggerSource: "API"
      })
    }));

    const body = await response.json();

    expect(response.status).toBe(201);
    // Must be one of the two known dispatch modes.
    expect(["adf", "local"]).toContain(body.executionMode);
  });

  it("returns 201 when triggerSource is Manual", async () => {
    const response = await POST(new Request("http://localhost/api/pipeline/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicationId: "10000000-0000-0000-0000-000000000001",
        triggerSource: "Manual"
      })
    }));

    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.status).toBe("Queued");
    expect(body.triggerSource ?? body.status).toBeTruthy();
  });

  it("each trigger produces a unique runId — no duplicate runs", async () => {
    const runIds = new Set<string>();

    for (let i = 0; i < 3; i++) {
      // Reset between runs so conflict check passes.
      resetRuntimeRepositoriesForTests();

      const response = await POST(new Request("http://localhost/api/pipeline/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: "10000000-0000-0000-0000-000000000001",
          triggerSource: "API"
        })
      }));

      const body = await response.json();
      expect(response.status).toBe(201);
      runIds.add(body.runId as string);
    }

    expect(runIds.size).toBe(3);
  });

  it("returns 409 when a run is already queued for the application (conflict guard)", async () => {
    const repository = getRuntimeValidationPipelineRepository();

    await repository.createRun({
      runId: "70000000-0000-0000-0000-000000000050",
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

    expect(response.status).toBe(409);
  });
});
