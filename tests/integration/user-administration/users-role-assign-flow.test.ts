import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/admin/users/route";
import { PUT } from "@/app/api/admin/users/[userId]/role/route";
import { getRuntimeRepositories, resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";

describe("US2 integration - role replacement", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
  });

  it("replaces role for existing user", async () => {
    const createResponse = await POST(
      new Request("http://localhost/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "role_replace_user",
          email: "role-replace-user@example.com",
          isActive: true
        })
      })
    );

    const createBody = await createResponse.json();
    const userId = createBody.userId as string;

    const firstRole = await PUT(
      new Request("http://localhost/api/admin/users/" + userId + "/role", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId: "viewer" })
      }),
      { params: Promise.resolve({ userId }) }
    );
    expect(firstRole.status).toBe(200);

    const secondRole = await PUT(
      new Request("http://localhost/api/admin/users/" + userId + "/role", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId: "administrator" })
      }),
      { params: Promise.resolve({ userId }) }
    );
    expect(secondRole.status).toBe(200);

    const repositories = getRuntimeRepositories();
    const effectiveRole = await repositories.roles.getRoleByUserId(userId);
    expect(effectiveRole).toBe("administrator");
  });
});
