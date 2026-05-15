import { beforeEach, describe, expect, it } from "vitest";
import { GET, POST as createUser } from "@/app/api/admin/users/route";
import { GET as getUserById } from "@/app/api/admin/users/[userId]/route";
import { PUT as assignRole } from "@/app/api/admin/users/[userId]/role/route";
import { PUT as updateActive } from "@/app/api/admin/users/[userId]/route";
import { resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";

describe("US4 integration - deactivate/reactivate", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
  });

  it("deactivates then reactivates user with includeInactive behavior", async () => {
    const createResponse = await createUser(
      new Request("http://localhost/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "active_flow_user",
          email: "active-flow-user@example.com",
          isActive: true
        })
      })
    );

    const created = await createResponse.json();
    const userId = created.userId as string;
    const originalUpdateDate = created.updateDate as string;

    const deactivate = await updateActive(
      new Request("http://localhost/api/admin/users/" + userId + "/active", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false })
      }),
      { params: Promise.resolve({ userId }) }
    );
    expect(deactivate.status).toBe(200);
    const deactivatedBody = await deactivate.json();
    expect(deactivatedBody.isActive).toBe(false);
    expect(deactivatedBody.updatedBy).toBe("30000000-0000-0000-0000-000000000001");
    expect(new Date(deactivatedBody.updateDate).getTime()).toBeGreaterThanOrEqual(new Date(originalUpdateDate).getTime());

    const detailAfterDeactivate = await getUserById(new Request("http://localhost"), { params: Promise.resolve({ userId }) });
    const detailBody = await detailAfterDeactivate.json();
    expect(detailBody.isActive).toBe(false);

    const listAfterDeactivate = await GET(new Request("http://localhost/api/admin/users", { method: "GET" }));
    const afterDeactivateBody = await listAfterDeactivate.json();
    expect(afterDeactivateBody.users.length).toBe(0);

    const listIncludingInactive = await GET(
      new Request("http://localhost/api/admin/users?includeInactive=true", { method: "GET" })
    );
    const includingInactiveBody = await listIncludingInactive.json();
    expect(includingInactiveBody.users.length).toBe(1);
    expect(includingInactiveBody.users[0].userId).toBe(userId);

    const reactivate = await updateActive(
      new Request("http://localhost/api/admin/users/" + userId + "/active", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true })
      }),
      { params: Promise.resolve({ userId }) }
    );
    expect(reactivate.status).toBe(200);
    const reactivatedBody = await reactivate.json();
    expect(reactivatedBody.isActive).toBe(true);

    const listAfterReactivate = await GET(new Request("http://localhost/api/admin/users", { method: "GET" }));
    const afterReactivateBody = await listAfterReactivate.json();
    expect(afterReactivateBody.users.length).toBe(1);
  });

  it("blocks deactivation when user is last active administrator", async () => {
    const createResponse = await createUser(
      new Request("http://localhost/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "last_admin_user",
          email: "last-admin-user@example.com",
          isActive: true
        })
      })
    );

    const created = await createResponse.json();
    const userId = created.userId as string;

    const roleResponse = await assignRole(
      new Request("http://localhost/api/admin/users/" + userId + "/role", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId: "administrator" })
      }),
      { params: Promise.resolve({ userId }) }
    );
    expect(roleResponse.status).toBe(200);

    const deactivate = await updateActive(
      new Request("http://localhost/api/admin/users/" + userId + "/active", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false })
      }),
      { params: Promise.resolve({ userId }) }
    );

    expect(deactivate.status).toBe(409);
    const body = await deactivate.json();
    expect(body.code).toBe("CONFLICT");
  });
});
