import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/pipeline/validation-results/[appId]/route";
import { getRuntimeValidationPipelineRepository, resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";
import { randomUUID } from "node:crypto";

const APP_ID = "10000000-0000-0000-0000-000000000001";
const RUN_ID = "70000000-0000-0000-0000-000000000060";
const ACTOR_ID = "30000000-0000-0000-0000-000000000001";

function makeRequest(appId: string, params: Record<string, string> = {}): Request {
  const url = new URL(`http://localhost/api/pipeline/validation-results/${appId}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return new Request(url.toString(), { method: "GET" });
}

async function seedResults(
  entries: Array<{ status: "Valid" | "Invalid" | "Duplicate" | "FilteredOut"; recordKey: string }>
) {
  const repository = getRuntimeValidationPipelineRepository();

  await repository.createRun({
    runId: RUN_ID,
    applicationId: APP_ID,
    triggerSource: "API",
    actorUserId: ACTOR_ID
  });

  await repository.upsertValidationResults(
    entries.map((e) => ({
      resultId: randomUUID(),
      pipelineRunId: RUN_ID,
      applicationId: APP_ID,
      stageId: randomUUID(),
      recordKey: e.recordKey,
      status: e.status,
      errorMessage: e.status !== "Valid" ? `Error for ${e.recordKey}` : null,
      actorUserId: ACTOR_ID
    }))
  );
}

describe("validation pipeline contract - validation result filtering query parameters", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = ACTOR_ID;
    resetRuntimeRepositoriesForTests();
  });

  it("returns 200 with all results when no filter is applied", async () => {
    await seedResults([
      { status: "Valid", recordKey: "ENG-001" },
      { status: "Invalid", recordKey: "ENG-002" },
      { status: "Duplicate", recordKey: "ENG-003" }
    ]);

    const response = await GET(makeRequest(APP_ID), {
      params: Promise.resolve({ appId: APP_ID })
    });

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.applicationId).toBe(APP_ID);
    expect(body.totalCount).toBe(3);
    expect(body.results).toHaveLength(3);
  });

  it("filters results by status=Invalid and returns only invalid records", async () => {
    await seedResults([
      { status: "Valid", recordKey: "ENG-001" },
      { status: "Invalid", recordKey: "ENG-002" },
      { status: "Invalid", recordKey: "ENG-003" }
    ]);

    const response = await GET(makeRequest(APP_ID, { status: "Invalid" }), {
      params: Promise.resolve({ appId: APP_ID })
    });

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.totalCount).toBe(2);
    expect(body.results.every((r: { status: string }) => r.status === "Invalid")).toBe(true);
  });

  it("filters results by status=FilteredOut and returns only filtered-out records", async () => {
    await seedResults([
      { status: "Valid", recordKey: "ENG-001" },
      { status: "FilteredOut", recordKey: "ENG-004" },
      { status: "FilteredOut", recordKey: "ENG-005" }
    ]);

    const response = await GET(makeRequest(APP_ID, { status: "FilteredOut" }), {
      params: Promise.resolve({ appId: APP_ID })
    });

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.totalCount).toBe(2);
    expect(body.results.every((r: { status: string }) => r.status === "FilteredOut")).toBe(true);
  });

  it("filters results by runId and returns only records for that run", async () => {
    const repository = getRuntimeValidationPipelineRepository();
    const otherRunId = "70000000-0000-0000-0000-000000000099";

    await seedResults([{ status: "Valid", recordKey: "ENG-001" }]);

    await repository.createRun({
      runId: otherRunId,
      applicationId: APP_ID,
      triggerSource: "API",
      actorUserId: ACTOR_ID
    });

    await repository.upsertValidationResults([{
      resultId: randomUUID(),
      pipelineRunId: otherRunId,
      applicationId: APP_ID,
      stageId: randomUUID(),
      recordKey: "ENG-999",
      status: "Invalid",
      errorMessage: "Other run error",
      actorUserId: ACTOR_ID
    }]);

    const response = await GET(makeRequest(APP_ID, { runId: RUN_ID }), {
      params: Promise.resolve({ appId: APP_ID })
    });

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.totalCount).toBe(1);
    expect(body.results[0].recordKey).toBe("ENG-001");
  });

  it("applies pagination using page and pageSize parameters", async () => {
    await seedResults([
      { status: "Valid", recordKey: "ENG-001" },
      { status: "Valid", recordKey: "ENG-002" },
      { status: "Valid", recordKey: "ENG-003" }
    ]);

    const response = await GET(makeRequest(APP_ID, { page: "1", pageSize: "2" }), {
      params: Promise.resolve({ appId: APP_ID })
    });

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(2);
    expect(body.results).toHaveLength(2);
    expect(body.totalCount).toBe(3);
  });

  it("returns 400 for invalid status filter value", async () => {
    const response = await GET(makeRequest(APP_ID, { status: "UnknownStatus" }), {
      params: Promise.resolve({ appId: APP_ID })
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid runId format in query", async () => {
    const response = await GET(makeRequest(APP_ID, { runId: "not-a-uuid" }), {
      params: Promise.resolve({ appId: APP_ID })
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("VALIDATION_ERROR");
  });

  it("returns 401 when no session is present", async () => {
    delete process.env.DEV_SESSION_USER_ID;

    const response = await GET(makeRequest(APP_ID), {
      params: Promise.resolve({ appId: APP_ID })
    });

    expect(response.status).toBe(401);
  });

  it("response shape includes applicationId, runId, totalCount, page, pageSize, and results array", async () => {
    await seedResults([{ status: "Valid", recordKey: "ENG-001" }]);

    const response = await GET(makeRequest(APP_ID), {
      params: Promise.resolve({ appId: APP_ID })
    });

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(typeof body.applicationId).toBe("string");
    expect(typeof body.totalCount).toBe("number");
    expect(typeof body.page).toBe("number");
    expect(typeof body.pageSize).toBe("number");
    expect(Array.isArray(body.results)).toBe(true);

    const result = body.results[0];
    expect(result).toHaveProperty("resultId");
    expect(result).toHaveProperty("stageId");
    expect(result).toHaveProperty("recordKey");
    expect(result).toHaveProperty("status");
    expect(result).toHaveProperty("errorMessage");
    expect(result).toHaveProperty("createDate");
  });
});
