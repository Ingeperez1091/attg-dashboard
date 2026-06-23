import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/admin/users/route";
import { resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";

describe("admin/users route POST - error branches", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
  });

  it("returns 400 with validation error for invalid payload", async () => {
    const request = new Request("http://localhost/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "" })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when email is missing", async () => {
    const request = new Request("http://localhost/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "valid_user" })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("returns error when user creation fails with duplicate email", async () => {
    const validPayload = {
      username: "dup_user",
      email: "dup@example.com",
      isActive: true
    };

    // First create succeeds
    const request1 = new Request("http://localhost/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload)
    });
    const response1 = await POST(request1);
    expect(response1.status).toBe(201);

    // Second create with same email should trigger the catch branch
    const request2 = new Request("http://localhost/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload)
    });
    const response2 = await POST(request2);
    // The inner catch re-throws, so it will be caught by the outer middleware error handler
    expect(response2.status).toBeGreaterThanOrEqual(400);
  });
});
