import { beforeEach, describe, expect, it } from "vitest";
import { POST as createUser } from "@/app/api/admin/users/route";
import { PUT as updateActive } from "@/app/api/admin/users/[userId]/route";
import { resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";

describe("US4 contract - active toggle", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
  });

  async function createTestUser(): Promise<string> {
    const response = await createUser(
      new Request("http://localhost/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "active_test_user",
          email: "active-test-user@example.com",
          isActive: true
        })
      })
    );

    const body = await response.json();
    return body.userId as string;
  }

  it("deactivates user with 200", async () => {
    const userId = await createTestUser();

    const response = await updateActive(
      new Request("http://localhost/api/admin/users/" + userId + "/active", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false })
      }),
      { params: Promise.resolve({ userId }) }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.isActive).toBe(false);
  });

  it("returns 400 for invalid payload", async () => {
    const userId = await createTestUser();

    const response = await updateActive(
      new Request("http://localhost/api/admin/users/" + userId + "/active", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: "bad" })
      }),
      { params: Promise.resolve({ userId }) }
    );

    expect(response.status).toBe(400);
  });
});
