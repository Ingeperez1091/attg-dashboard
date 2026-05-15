import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/pipeline/run/route";
import { GET } from "@/app/api/pipeline/[runId]/route";
import { getRuntimeValidationPipelineRepository, resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";

describe("validation pipeline contract - run trigger and status", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
  });

  it("returns 201 and queued run metadata when trigger payload is valid", async () => {
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
    expect(body.runId).toBeTruthy();
    expect(body.applicationId).toBe("10000000-0000-0000-0000-000000000001");
    expect(body.status).toBe("Queued");
    expect(body.executionMode === "local" || body.executionMode === "adf").toBe(true);
  });

  it("returns 400 for invalid trigger payload", async () => {
    const response = await POST(new Request("http://localhost/api/pipeline/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId: "bad-id", triggerSource: "API" })
    }));

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("VALIDATION_ERROR");
  });

  it("returns 401 when no session is available", async () => {
    delete process.env.DEV_SESSION_USER_ID;

    const response = await POST(new Request("http://localhost/api/pipeline/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicationId: "10000000-0000-0000-0000-000000000001",
        triggerSource: "API"
      })
    }));

    const body = await response.json();
    expect(response.status).toBe(401);
    expect(body.error).toBe("UNAUTHORIZED");
  });

  it("returns 200 for run status and 404 for unknown run id", async () => {
    const repository = getRuntimeValidationPipelineRepository();

    await repository.createRun({
      runId: "70000000-0000-0000-0000-000000000001",
      applicationId: "10000000-0000-0000-0000-000000000001",
      triggerSource: "API",
      actorUserId: "30000000-0000-0000-0000-000000000001"
    });

    const okResponse = await GET(
      new Request("http://localhost/api/pipeline/70000000-0000-0000-0000-000000000001", { method: "GET" }),
      { params: Promise.resolve({ runId: "70000000-0000-0000-0000-000000000001" }) }
    );

    const okBody = await okResponse.json();
    expect(okResponse.status).toBe(200);
    expect(okBody.status).toBe("Queued");

    const notFoundResponse = await GET(
      new Request("http://localhost/api/pipeline/70000000-0000-0000-0000-000000000099", { method: "GET" }),
      { params: Promise.resolve({ runId: "70000000-0000-0000-0000-000000000099" }) }
    );

    expect(notFoundResponse.status).toBe(404);
  });
});
