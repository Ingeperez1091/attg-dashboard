import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/pipeline/validation-results/[appId]/route";
import { getRuntimeValidationPipelineRepository, resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";
import { randomUUID } from "node:crypto";

const APP_ID = "10000000-0000-0000-0000-000000000001";
const RUN_ID = "70000000-0000-0000-0000-000000000070";
const ACTOR_ID = "30000000-0000-0000-0000-000000000001";

function makeRequest(appId: string, params: Record<string, string> = {}): Request {
  const url = new URL(`http://localhost/api/pipeline/validation-results/${appId}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return new Request(url.toString(), { method: "GET" });
}

async function seedMixedResults() {
  const repository = getRuntimeValidationPipelineRepository();

  await repository.createRun({
    runId: RUN_ID,
    applicationId: APP_ID,
    triggerSource: "API",
    actorUserId: ACTOR_ID
  });

  await repository.upsertValidationResults([
    {
      resultId: "80000000-0000-0000-0000-000000000001",
      pipelineRunId: RUN_ID,
      applicationId: APP_ID,
      stageId: randomUUID(),
      recordKey: "ENG-001",
      status: "Valid",
      errorMessage: null,
      actorUserId: ACTOR_ID
    },
    {
      resultId: "80000000-0000-0000-0000-000000000002",
      pipelineRunId: RUN_ID,
      applicationId: APP_ID,
      stageId: randomUUID(),
      recordKey: "ENG-002",
      status: "Invalid",
      errorMessage: "Engagement ID ENG-002 not found in denominator",
      actorUserId: ACTOR_ID
    },
    {
      resultId: "80000000-0000-0000-0000-000000000003",
      pipelineRunId: RUN_ID,
      applicationId: APP_ID,
      stageId: randomUUID(),
      recordKey: null,
      status: "Invalid",
      errorMessage: "Missing Engagement/Client ID",
      actorUserId: ACTOR_ID
    },
    {
      resultId: "80000000-0000-0000-0000-000000000004",
      pipelineRunId: RUN_ID,
      applicationId: APP_ID,
      stageId: randomUUID(),
      recordKey: "ENG-004",
      status: "Duplicate",
      errorMessage: "Duplicate match key in staged batch",
      actorUserId: ACTOR_ID
    },
    {
      resultId: "80000000-0000-0000-0000-000000000005",
      pipelineRunId: RUN_ID,
      applicationId: APP_ID,
      stageId: randomUUID(),
      recordKey: "ENG-005",
      status: "FilteredOut",
      errorMessage: "Failed filter rule(s): Budget GREATER_OR_EQUAL 20000",
      actorUserId: ACTOR_ID
    }
  ]);
}

describe("validation pipeline contract - result payload shape and pagination", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = ACTOR_ID;
    resetRuntimeRepositoriesForTests();
  });

  it("response shape includes all required top-level fields", async () => {
    await seedMixedResults();

    const response = await GET(makeRequest(APP_ID), {
      params: Promise.resolve({ appId: APP_ID })
    });

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveProperty("applicationId", APP_ID);
    expect(body).toHaveProperty("totalCount");
    expect(body).toHaveProperty("page");
    expect(body).toHaveProperty("pageSize");
    expect(body).toHaveProperty("results");
    expect(Array.isArray(body.results)).toBe(true);
  });

  it("each result item includes all contract-required fields with correct types", async () => {
    await seedMixedResults();

    const response = await GET(makeRequest(APP_ID), {
      params: Promise.resolve({ appId: APP_ID })
    });

    const body = await response.json();
    const result = body.results[0];

    expect(typeof result.resultId).toBe("string");
    expect(typeof result.stageId).toBe("string");
    // recordKey may be null for invalid records.
    expect(["string", "object"].includes(typeof result.recordKey)).toBe(true);
    expect(["Valid", "Invalid", "Duplicate", "FilteredOut"].includes(result.status)).toBe(true);
    // errorMessage may be null for Valid records.
    expect(["string", "object"].includes(typeof result.errorMessage)).toBe(true);
    expect(typeof result.createDate).toBe("string");
  });

  it("Valid records have null errorMessage in the response payload", async () => {
    await seedMixedResults();

    const response = await GET(makeRequest(APP_ID, { status: "Valid" }), {
      params: Promise.resolve({ appId: APP_ID })
    });

    const body = await response.json();
    expect(body.results.every((r: { errorMessage: unknown }) => r.errorMessage === null)).toBe(true);
  });

  it("Invalid records carry explicit non-null errorMessage describing the failure reason", async () => {
    await seedMixedResults();

    const response = await GET(makeRequest(APP_ID, { status: "Invalid" }), {
      params: Promise.resolve({ appId: APP_ID })
    });

    const body = await response.json();
    expect(body.results.length).toBeGreaterThan(0);
    expect(body.results.every((r: { errorMessage: unknown }) => typeof r.errorMessage === "string")).toBe(true);
  });

  it("FilteredOut records carry non-null errorMessage naming the failed filter rule(s)", async () => {
    await seedMixedResults();

    const response = await GET(makeRequest(APP_ID, { status: "FilteredOut" }), {
      params: Promise.resolve({ appId: APP_ID })
    });

    const body = await response.json();
    expect(body.results.length).toBeGreaterThan(0);
    expect(body.results.every((r: { errorMessage: unknown }) => typeof r.errorMessage === "string")).toBe(true);
  });

  it("totalCount reflects full result set even when page is limited via pageSize", async () => {
    await seedMixedResults();

    const response = await GET(makeRequest(APP_ID, { pageSize: "2", page: "1" }), {
      params: Promise.resolve({ appId: APP_ID })
    });

    const body = await response.json();

    expect(body.results).toHaveLength(2);
    expect(body.totalCount).toBe(5);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(2);
  });

  it("page 2 returns the remaining records when pageSize=3, totalCount=5", async () => {
    await seedMixedResults();

    const response = await GET(makeRequest(APP_ID, { pageSize: "3", page: "2" }), {
      params: Promise.resolve({ appId: APP_ID })
    });

    const body = await response.json();

    expect(body.page).toBe(2);
    expect(body.results).toHaveLength(2);
    expect(body.totalCount).toBe(5);
  });

  it("empty results array and totalCount=0 when no results exist for application", async () => {
    const response = await GET(makeRequest(APP_ID), {
      params: Promise.resolve({ appId: APP_ID })
    });

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.results).toHaveLength(0);
    expect(body.totalCount).toBe(0);
  });
});
