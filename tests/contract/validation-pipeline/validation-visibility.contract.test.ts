import { beforeEach, describe, expect, it } from "vitest";
import { GET as getValidationResults } from "@/app/api/pipeline/validation-results/[appId]/route";
import { GET as getRunStatus } from "@/app/api/pipeline/[runId]/route";
import { getRuntimeRepositories, getRuntimeValidationPipelineRepository, resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";

const APP_ID_A = "10000000-0000-0000-0000-000000000001";
const APP_ID_B = "10000000-0000-0000-0000-000000000002";
const RUN_ID = "70000000-0000-0000-0000-000000000080";

async function createUser(
  role: "administrator" | "application_owner" | "viewer",
  appId?: string
): Promise<string> {
  const repositories = getRuntimeRepositories();
  const user = await repositories.users.create({
    username: `${role}_vis_${Date.now()}`,
    email: `${role}_vis_${Date.now()}@example.com`,
    isActive: true,
    actorUserId: "seed"
  });
  await repositories.roles.assignRole(user.userId, role, "seed");

  if (appId) {
    await repositories.userApplications.assign(user.userId, appId, "seed");
  }

  return user.userId;
}

function authHeader(userId: string): Record<string, string> {
  return { Authorization: `Bearer ${userId}` };
}

function makeResultsRequest(appId: string, userId: string): Request {
  return new Request(`http://localhost/api/pipeline/validation-results/${appId}`, {
    method: "GET",
    headers: authHeader(userId)
  });
}

describe("validation pipeline contract - app-scoped authorization and visibility", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    delete process.env.DEV_SESSION_USER_ID;
    resetRuntimeRepositoriesForTests();
  });

  it("returns 401 when no session is present on validation-results endpoint", async () => {
    const response = await getValidationResults(
      new Request(`http://localhost/api/pipeline/validation-results/${APP_ID_A}`, { method: "GET" }),
      { params: Promise.resolve({ appId: APP_ID_A }) }
    );

    expect(response.status).toBe(401);
  });

  it("returns 401 when no session is present on run-status endpoint", async () => {
    const response = await getRunStatus(
      new Request(`http://localhost/api/pipeline/${RUN_ID}`, { method: "GET" }),
      { params: Promise.resolve({ runId: RUN_ID }) }
    );

    expect(response.status).toBe(401);
  });

  it("returns 403 for viewer role — viewers cannot access pipeline validation results", async () => {
    const viewerUserId = await createUser("viewer", APP_ID_A);

    const response = await getValidationResults(
      makeResultsRequest(APP_ID_A, viewerUserId),
      { params: Promise.resolve({ appId: APP_ID_A }) }
    );

    expect(response.status).toBe(403);
  });

  it("returns 403 for application_owner accessing an unassigned application", async () => {
    const ownerUserId = await createUser("application_owner", APP_ID_A);

    // User owns APP_ID_A but is trying to read APP_ID_B.
    const response = await getValidationResults(
      makeResultsRequest(APP_ID_B, ownerUserId),
      { params: Promise.resolve({ appId: APP_ID_B }) }
    );

    expect(response.status).toBe(403);
  });

  it("returns 200 for application_owner accessing their assigned application", async () => {
    const ownerUserId = await createUser("application_owner", APP_ID_A);

    const response = await getValidationResults(
      makeResultsRequest(APP_ID_A, ownerUserId),
      { params: Promise.resolve({ appId: APP_ID_A }) }
    );

    // 200 with empty results is the correct response for an authorized request with no data.
    expect(response.status).toBe(200);
  });

  it("returns 200 for administrator accessing any application", async () => {
    const adminUserId = await createUser("administrator");

    const response = await getValidationResults(
      makeResultsRequest(APP_ID_B, adminUserId),
      { params: Promise.resolve({ appId: APP_ID_B }) }
    );

    expect(response.status).toBe(200);
  });

  it("run-status endpoint respects application-level scope — owner of different app cannot read run", async () => {
    const ownerOfA = await createUser("application_owner", APP_ID_A);

    // Seed a run that belongs to APP_ID_B.
    const repository = getRuntimeValidationPipelineRepository();
    await repository.createRun({
      runId: RUN_ID,
      applicationId: APP_ID_B,
      triggerSource: "API",
      actorUserId: "seed"
    });

    const response = await getRunStatus(
      new Request(`http://localhost/api/pipeline/${RUN_ID}`, {
        method: "GET",
        headers: authHeader(ownerOfA)
      }),
      { params: Promise.resolve({ runId: RUN_ID }) }
    );

    expect(response.status).toBe(403);
  });

  it("administrator can read a run belonging to any application", async () => {
    const adminUserId = await createUser("administrator");

    const repository = getRuntimeValidationPipelineRepository();
    await repository.createRun({
      runId: RUN_ID,
      applicationId: APP_ID_B,
      triggerSource: "API",
      actorUserId: "seed"
    });

    const response = await getRunStatus(
      new Request(`http://localhost/api/pipeline/${RUN_ID}`, {
        method: "GET",
        headers: authHeader(adminUserId)
      }),
      { params: Promise.resolve({ runId: RUN_ID }) }
    );

    expect(response.status).toBe(200);
  });
});
