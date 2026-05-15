import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/admin/users/route";
import { PUT } from "@/app/api/admin/users/[userId]/role/route";
import { resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";

describe("US2 contract - assign role", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
  });

  async function createTestUser(): Promise<string> {
    const response = await POST(
      new Request("http://localhost/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "role_test_user",
          email: "role-test-user@example.com",
          isActive: true
        })
      })
    );

    const body = await response.json();
    return body.userId as string;
  }

  it("returns 200 for valid role assignment", async () => {
    const userId = await createTestUser();

    const response = await PUT(
      new Request("http://localhost/api/admin/users/" + userId + "/role", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId: "application_owner" })
      }),
      { params: Promise.resolve({ userId }) }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.roleId).toBe("application_owner");
  });

  it("returns 400 for invalid role value", async () => {
    const userId = await createTestUser();

    const response = await PUT(
      new Request("http://localhost/api/admin/users/" + userId + "/role", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId: "bad_role" })
      }),
      { params: Promise.resolve({ userId }) }
    );

    expect(response.status).toBe(400);
  });
});
