import { beforeEach, describe, expect, it } from "vitest";
import { GET, PUT } from "@/app/api/filters/numerator/[appId]/route";
import { getRuntimeRepositories, resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";
import { resetRuntimeNumeratorFilterRepositoryForTests } from "@/infrastructure/persistence/runtime/repositories";

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

describe("contract - filter authorization", () => {
  const appId = "10000000-0000-0000-0000-000000000005";

  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    delete process.env.DEV_SESSION_USER_ID;
    resetRuntimeRepositoriesForTests();
    resetRuntimeNumeratorFilterRepositoryForTests();
  });

  it("returns 403 for read when user lacks application assignment", async () => {
    const ownerUserId = await createSessionUser("application_owner");

    const response = await GET(new Request(`http://localhost/api/filters/numerator/${appId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${ownerUserId}` }
    }), { params: Promise.resolve({ appId }) });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Forbidden");
  });

  it("returns 403 for write when assigned user role is viewer", async () => {
    const viewerUserId = await createSessionUser("viewer", appId);

    const response = await PUT(new Request(`http://localhost/api/filters/numerator/${appId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${viewerUserId}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        rules: [
          {
            applicationModelFieldId: "40000000-0000-0000-0505-000000000005",
            operator: "GREATER_OR_EQUAL",
            value: "1000"
          }
        ]
      })
    }), { params: Promise.resolve({ appId }) });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Forbidden");
  });

  it("returns 200 for write when assigned role is application_owner", async () => {
    const ownerUserId = await createSessionUser("application_owner", appId);

    const response = await PUT(new Request(`http://localhost/api/filters/numerator/${appId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${ownerUserId}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        rules: [
          {
            applicationModelFieldId: "40000000-0000-0000-0505-000000000005",
            operator: "LESS_OR_EQUAL",
            value: "90000"
          }
        ]
      })
    }), { params: Promise.resolve({ appId }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.lastUpdatedBy).toBe(ownerUserId);
  });
});

