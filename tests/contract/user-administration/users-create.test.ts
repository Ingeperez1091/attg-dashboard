import { beforeEach, describe, expect, it } from "vitest";
import * as process from "node:process";
import { GET, POST } from "@/app/api/admin/users/route";
import { resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";

describe("US1 contract - create users", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
  });

  it("returns 201 for valid payload", async () => {
    const request = new Request("http://localhost/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "test_owner",
        email: "owner@example.com",
        displayName: "Test Owner",
        isActive: true
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.userId).toBeDefined();
    expect(body.email).toBe("owner@example.com");
  });

  it("returns 400 for invalid email", async () => {
    const request = new Request("http://localhost/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "test_owner",
        email: "not-an-email",
        isActive: true
      })
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 401 when no session is available", async () => {
    delete process.env.DEV_SESSION_USER_ID;
    const request = new Request("http://localhost/api/admin/users", {
      method: "GET"
    });

    const response = await GET(request);
    expect(response.status).toBe(401);
  });
});
