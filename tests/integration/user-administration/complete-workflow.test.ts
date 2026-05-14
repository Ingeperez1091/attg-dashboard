import { beforeEach, describe, expect, it } from "vitest";
import { GET as listUsers, POST as createUser } from "@/app/api/admin/users/route";
import { PUT as assignRole } from "@/app/api/admin/users/[userId]/role/route";
import { GET as listApplications, POST as assignApplications } from "@/app/api/admin/users/[userId]/applications/route";
import { PUT as updateActive } from "@/app/api/admin/users/[userId]/route";
import { getRuntimeRepositories, resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";

describe("Phase 8 integration - complete workflow", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
  });

  it("completes create to reactivate workflow with traceable audit fields", async () => {
    const createdResponse = await createUser(
      new Request("http://localhost/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "complete_workflow_user",
          email: "complete-workflow-user@example.com",
          displayName: "Complete Workflow User",
          isActive: true
        })
      })
    );

    expect(createdResponse.status).toBe(201);
    const created = await createdResponse.json();
    const userId = created.userId as string;

    const listResponse = await listUsers(new Request("http://localhost/api/admin/users", { method: "GET" }));
    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json();
    expect(listBody.users.some((user: { userId: string }) => user.userId === userId)).toBe(true);

    const roleResponse = await assignRole(
      new Request("http://localhost/api/admin/users/" + userId + "/role", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId: "application_owner" })
      }),
      { params: Promise.resolve({ userId }) }
    );
    expect(roleResponse.status).toBe(200);

    const assignAppsResponse = await assignApplications(
      new Request("http://localhost/api/admin/users/" + userId + "/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true })
      }),
      { params: Promise.resolve({ userId }) }
    );
    expect(assignAppsResponse.status).toBe(201);

    const applicationsResponse = await listApplications(new Request("http://localhost"), { params: Promise.resolve({ userId }) });
    expect(applicationsResponse.status).toBe(200);
    const applicationsBody = await applicationsResponse.json();
    expect(applicationsBody.applications).toContain("*");

    const deactivateResponse = await updateActive(
      new Request("http://localhost/api/admin/users/" + userId + "/active", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false })
      }),
      { params: Promise.resolve({ userId }) }
    );
    expect(deactivateResponse.status).toBe(200);

    const defaultListAfterDeactivate = await listUsers(new Request("http://localhost/api/admin/users", { method: "GET" }));
    const defaultListBody = await defaultListAfterDeactivate.json();
    expect(defaultListBody.users.some((user: { userId: string }) => user.userId === userId)).toBe(false);

    const includeInactiveList = await listUsers(
      new Request("http://localhost/api/admin/users?includeInactive=true", { method: "GET" })
    );
    const includeInactiveBody = await includeInactiveList.json();
    expect(includeInactiveBody.users.some((user: { userId: string }) => user.userId === userId)).toBe(true);

    const reactivateResponse = await updateActive(
      new Request("http://localhost/api/admin/users/" + userId + "/active", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true })
      }),
      { params: Promise.resolve({ userId }) }
    );
    expect(reactivateResponse.status).toBe(200);

    const finalList = await listUsers(new Request("http://localhost/api/admin/users", { method: "GET" }));
    const finalBody = await finalList.json();
    expect(finalBody.users.some((user: { userId: string }) => user.userId === userId)).toBe(true);

    const repositories = getRuntimeRepositories();
    const storedUser = await repositories.users.findById(userId);
    expect(storedUser).not.toBeNull();
    expect(storedUser?.createdBy).toBe("30000000-0000-0000-0000-000000000001");
    expect(storedUser?.updatedBy).toBe("30000000-0000-0000-0000-000000000001");

    const effectiveRole = await repositories.roles.getRoleByUserId(userId);
    expect(effectiveRole).toBe("application_owner");
  });
});
