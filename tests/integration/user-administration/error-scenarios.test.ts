import { beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { GET as listUsers, POST as createUser } from "@/app/api/admin/users/route";
import { GET as getUserById } from "@/app/api/admin/users/[userId]/route";
import { PUT as assignRole } from "@/app/api/admin/users/[userId]/role/route";
import { resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";

function expectStructuredError(body: unknown): void {
  const typed = body as { code?: string; message?: string; requestId?: string };
  expect(typeof typed.code).toBe("string");
  expect(typeof typed.message).toBe("string");
  expect(typeof typed.requestId).toBe("string");
  expect((typed.requestId ?? "").length).toBeGreaterThan(0);
}

describe("Phase 8 integration - error scenarios", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
  });

  it("returns 400 for invalid create payload", async () => {
    const response = await createUser(
      new Request("http://localhost/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "bad_email_user", email: "not-an-email", isActive: true })
      })
    );

    expect(response.status).toBe(400);
    expectStructuredError(await response.json());
  });

  it("returns 401 when no session context is available", async () => {
    delete process.env.DEV_SESSION_USER_ID;
    resetRuntimeRepositoriesForTests();

    const response = await listUsers(new Request("http://localhost/api/admin/users", { method: "GET" }));

    expect(response.status).toBe(401);
    expectStructuredError(await response.json());
  });

  it("returns 403 for non-admin caller", async () => {
    const created = await createUser(
      new Request("http://localhost/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "viewer_error_user", email: "viewer-error-user@example.com", isActive: true })
      })
    );
    const createdBody = await created.json();
    const userId = createdBody.userId as string;

    const roleResponse = await assignRole(
      new Request("http://localhost/api/admin/users/" + userId + "/role", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId: "viewer" })
      }),
      { params: Promise.resolve({ userId }) }
    );
    expect(roleResponse.status).toBe(200);

    const response = await listUsers(
      new Request("http://localhost/api/admin/users", {
        method: "GET",
        headers: { Authorization: "Bearer " + userId }
      })
    );

    expect(response.status).toBe(403);
    expectStructuredError(await response.json());
  });

  it("returns 404 for missing user", async () => {
    const response = await getUserById(new Request("http://localhost"), { params: Promise.resolve({ userId: randomUUID() }) });

    expect(response.status).toBe(404);
    expectStructuredError(await response.json());
  });

  it("returns 409 for duplicate user", async () => {
    const first = await createUser(
      new Request("http://localhost/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "duplicate_error_user", email: "duplicate-error-user@example.com", isActive: true })
      })
    );
    expect(first.status).toBe(201);

    const second = await createUser(
      new Request("http://localhost/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "duplicate_error_user", email: "duplicate-error-user@example.com", isActive: true })
      })
    );

    expect(second.status).toBe(409);
    expectStructuredError(await second.json());
  });

  it("returns 500 for runtime repository failure", async () => {
    process.env.USE_INMEMORY_REPOSITORY = "false";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();

    const response = await listUsers(new Request("http://localhost/api/admin/users", { method: "GET" }));

    expect(response.status).toBe(500);
    const body = await response.json();
    expectStructuredError(body);
    expect((body as { code: string }).code).toBe("INTERNAL_ERROR");
  });
});
