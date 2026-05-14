import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/filters/denominator/[appId]/route";
import {
  getRuntimeRepositories,
  resetRuntimeDenominatorFilterRepositoryForTests,
  resetRuntimeRepositoriesForTests
} from "@/infrastructure/persistence/runtime/repositories";

async function createSessionUser(
  role: "administrator" | "application_owner" | "viewer",
  appId?: string
): Promise<string> {
  const repositories = getRuntimeRepositories();
  const user = await repositories.users.create({
    username: `${role}_${Date.now()}`,
    email: `${role}_${Date.now()}@example.com`,
    isActive: true,
    actorUserId: "seed"
  });

  await repositories.roles.assignRole(user.userId, role, "seed");
  if (appId) {
    await repositories.userApplications.assign(user.userId, appId, "seed");
  }

  return user.userId;
}

describe("integration - denominator filter view authorization", () => {
  const appId = "10000000-0000-0000-0000-000000000001";

  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    delete process.env.DEV_SESSION_USER_ID;
    resetRuntimeRepositoriesForTests();
    resetRuntimeDenominatorFilterRepositoryForTests();
  });

  it("returns 401 when no session is present", async () => {
    const response = await GET(new Request(`http://localhost/api/filters/denominator/${appId}`, {
      method: "GET"
    }), { params: Promise.resolve({ appId }) });

    expect(response.status).toBe(401);
  });

  it("returns 200 for assigned viewer read", async () => {
    const viewerUserId = await createSessionUser("viewer", appId);

    const response = await GET(new Request(`http://localhost/api/filters/denominator/${appId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${viewerUserId}`
      }
    }), { params: Promise.resolve({ appId }) });

    expect(response.status).toBe(200);
  });

  it("returns 403 for application owner without assignment", async () => {
    const ownerUserId = await createSessionUser("application_owner");

    const response = await GET(new Request(`http://localhost/api/filters/denominator/${appId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${ownerUserId}`
      }
    }), { params: Promise.resolve({ appId }) });

    expect(response.status).toBe(403);
  });
});
