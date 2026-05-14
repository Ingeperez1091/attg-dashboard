import { beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/admin/users/route";
import { resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";

describe("US1 integration - create and list users", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
  });

  it("creates a user and returns it in list response", async () => {
    const createRequest = new Request("http://localhost/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "integration_owner",
        email: "integration-owner@example.com",
        displayName: "Integration Owner",
        isActive: true
      })
    });

    const createResponse = await POST(createRequest);
    expect(createResponse.status).toBe(201);

    const listRequest = new Request("http://localhost/api/admin/users", {
      method: "GET"
    });

    const listResponse = await GET(listRequest);
    const body = await listResponse.json();

    expect(listResponse.status).toBe(200);
    expect(Array.isArray(body.users)).toBe(true);
    expect(body.users.length).toBe(1);
    expect(body.users[0].email).toBe("integration-owner@example.com");
    expect(body.users[0].createdBy).toBe("30000000-0000-0000-0000-000000000001");
  });
});
