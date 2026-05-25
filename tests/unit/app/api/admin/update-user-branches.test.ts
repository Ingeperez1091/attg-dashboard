import { beforeEach, describe, expect, it } from "vitest";
import { POST as createUser } from "@/app/api/admin/users/route";
import { updateAdminUser } from "@/app/api/admin/users/[userId]/update-user";
import { resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";

describe("update-user - error branches", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
  });

  it("throws 404 when user does not exist", async () => {
    await expect(
      updateAdminUser({
        userId: "99999999-0000-0000-0000-000000000099",
        actorUserId: "30000000-0000-0000-0000-000000000001",
        isActive: true,
        eventName: "user.update"
      })
    ).rejects.toThrow("User not found.");
  });

  it("updates an existing user successfully", async () => {
    const createResponse = await createUser(
      new Request("http://localhost/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "update_test", email: "update@example.com", isActive: true })
      })
    );
    const { userId } = await createResponse.json();

    const response = await updateAdminUser({
      userId,
      actorUserId: "30000000-0000-0000-0000-000000000001",
      isActive: false,
      eventName: "user.update"
    });

    expect(response.status).toBe(200);
  });
});
