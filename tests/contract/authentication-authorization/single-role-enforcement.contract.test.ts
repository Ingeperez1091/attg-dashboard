import { beforeEach, describe, expect, it } from "vitest";
import { POST as createUser } from "@/app/api/admin/users/route";
import { PUT as assignRole } from "@/app/api/admin/users/[userId]/role/route";
import { getRuntimeRepositories, resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";

describe("contract - single active role enforcement", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
  });

  it("replaces existing role when assigning a new role", async () => {
    const createdResponse = await createUser(
      new Request("http://localhost/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: `single_role_${Date.now()}`,
          email: `single_role_${Date.now()}@example.com`,
          isActive: true,
          roleId: "viewer"
        })
      })
    );

    expect(createdResponse.status).toBe(201);
    const created = (await createdResponse.json()) as { userId: string };

    const firstAssign = await assignRole(
      new Request(`http://localhost/api/admin/users/${created.userId}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId: "application_owner" })
      }),
      { params: Promise.resolve({ userId: created.userId }) }
    );
    expect(firstAssign.status).toBe(200);

    const secondAssign = await assignRole(
      new Request(`http://localhost/api/admin/users/${created.userId}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId: "administrator" })
      }),
      { params: Promise.resolve({ userId: created.userId }) }
    );
    expect(secondAssign.status).toBe(200);

    const repositories = getRuntimeRepositories();
    const currentRole = await repositories.roles.getRoleByUserId(created.userId);
    expect(currentRole).toBe("administrator");
  });
});
