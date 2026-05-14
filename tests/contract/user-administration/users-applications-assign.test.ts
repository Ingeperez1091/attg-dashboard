import { beforeEach, describe, expect, it } from "vitest";
import { POST as createUser } from "@/app/api/admin/users/route";
import { GET as getApplications, POST as assignApplications } from "@/app/api/admin/users/[userId]/applications/route";
import { resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";

describe("US3 contract - assign applications", () => {
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
          username: "apps_test_user",
          email: "apps-test-user@example.com",
          isActive: true
        })
      })
    );

    const body = await response.json();
    return body.userId as string;
  }

  it("assigns a specific application", async () => {
    const userId = await createTestUser();
    const response = await assignApplications(
      new Request("http://localhost/api/admin/users/" + userId + "/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: "10000000-0000-0000-0000-000000000001" })
      }),
      { params: Promise.resolve({ userId }) }
    );

    expect(response.status).toBe(201);
  });

  it("lists assigned applications", async () => {
    const userId = await createTestUser();
    await assignApplications(
      new Request("http://localhost/api/admin/users/" + userId + "/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true })
      }),
      { params: Promise.resolve({ userId }) }
    );

    const listResponse = await getApplications(new Request("http://localhost"), { params: Promise.resolve({ userId }) });
    const body = await listResponse.json();

    expect(listResponse.status).toBe(200);
    expect(body.applications).toContain("*");
  });
});
