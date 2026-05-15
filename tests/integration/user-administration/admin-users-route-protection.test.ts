import { beforeEach, describe, expect, it } from "vitest";
import { POST as createUser } from "@/app/api/admin/users/route";
import { PUT as assignRole } from "@/app/api/admin/users/[userId]/role/route";
import { evaluateAdminUsersRouteAccess } from "@/lib/auth/admin-access";
import { getRuntimeRepositories, resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";

describe("US5 integration - admin route protection", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
  });

  async function createUserWithRole(username: string, email: string, roleId: "application_owner" | "viewer") {
    const createResponse = await createUser(
      new Request("http://localhost/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, isActive: true })
      })
    );

    const created = await createResponse.json();
    const userId = created.userId as string;

    const roleResponse = await assignRole(
      new Request("http://localhost/api/admin/users/" + userId + "/role", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId })
      }),
      { params: Promise.resolve({ userId }) }
    );

    expect(roleResponse.status).toBe(200);
    return userId;
  }

  it("allows administrators", async () => {
    const repositories = getRuntimeRepositories();
    const request = new Request("http://localhost/admin/users");

    const access = await evaluateAdminUsersRouteAccess(request, repositories);
    expect(access.status).toBe(200);
  });

  it("denies application owners", async () => {
    const userId = await createUserWithRole("owner_route_user", "owner-route-user@example.com", "application_owner");
    const repositories = getRuntimeRepositories();

    const request = new Request("http://localhost/admin/users", {
      headers: {
        Authorization: "Bearer " + userId
      }
    });

    const access = await evaluateAdminUsersRouteAccess(request, repositories);
    expect(access.status).toBe(403);
  });

  it("denies viewers", async () => {
    const userId = await createUserWithRole("viewer_route_user", "viewer-route-user@example.com", "viewer");
    const repositories = getRuntimeRepositories();

    const request = new Request("http://localhost/admin/users", {
      headers: {
        Authorization: "Bearer " + userId
      }
    });

    const access = await evaluateAdminUsersRouteAccess(request, repositories);
    expect(access.status).toBe(403);
  });

  it("redirects unauthenticated requests to login", async () => {
    delete process.env.DEV_SESSION_USER_ID;
    const repositories = getRuntimeRepositories();
    const request = new Request("http://localhost/admin/users");

    const access = await evaluateAdminUsersRouteAccess(request, repositories);
    expect(access.status).toBe(302);
    expect(access.redirectTo).toBe("/login?returnUrl=/admin/users");
  });
});
