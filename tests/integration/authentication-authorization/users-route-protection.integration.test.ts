import { beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/users/route";
import { getRuntimeRepositories, resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";

describe("integration - SEC-002 /api/users route protection", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    delete process.env.DEV_SESSION_USER_ID;
    resetRuntimeRepositoriesForTests();
  });

  it("rejects unauthenticated GET with 401", async () => {
    const response = await GET(new Request("http://localhost/api/users"));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("rejects unauthenticated POST with 401", async () => {
    const response = await POST(
      new Request("http://localhost/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "attacker_user",
          email: "attacker@evil.com",
          isActive: true
        })
      })
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("rejects non-admin authenticated GET with 403", async () => {
    const repositories = getRuntimeRepositories();
    const viewer = await repositories.users.create({
      username: "viewer_sec002",
      email: "viewer-sec002@example.com",
      displayName: "Viewer SEC002",
      isActive: true,
      actorUserId: "seed"
    });
    await repositories.roles.assignRole(viewer.userId, "viewer", "seed");

    const response = await GET(
      new Request("http://localhost/api/users", {
        headers: { Cookie: `dev_user_id=${viewer.userId}` }
      })
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.code).toBe("FORBIDDEN");
  });

  it("rejects application_owner POST with 403", async () => {
    const repositories = getRuntimeRepositories();
    const owner = await repositories.users.create({
      username: "owner_sec002",
      email: "owner-sec002@example.com",
      displayName: "Owner SEC002",
      isActive: true,
      actorUserId: "seed"
    });
    await repositories.roles.assignRole(owner.userId, "application_owner", "seed");

    const response = await POST(
      new Request("http://localhost/api/users", {
        method: "POST",
        headers: {
          Cookie: `dev_user_id=${owner.userId}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username: "unauthorized_create",
          email: "unauthorized@example.com",
          isActive: true
        })
      })
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.code).toBe("FORBIDDEN");
  });

  it("allows administrator GET with 200", async () => {
    const repositories = getRuntimeRepositories();
    const admin = await repositories.users.create({
      username: "admin_sec002",
      email: "admin-sec002@example.com",
      displayName: "Admin SEC002",
      isActive: true,
      actorUserId: "seed"
    });
    await repositories.roles.assignRole(admin.userId, "administrator", "seed");

    const response = await GET(
      new Request("http://localhost/api/users", {
        headers: { Cookie: `dev_user_id=${admin.userId}` }
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("users");
  });

  it("allows administrator POST with 201", async () => {
    const repositories = getRuntimeRepositories();
    const admin = await repositories.users.create({
      username: "admin_sec002_post",
      email: "admin-sec002-post@example.com",
      displayName: "Admin SEC002 Post",
      isActive: true,
      actorUserId: "seed"
    });
    await repositories.roles.assignRole(admin.userId, "administrator", "seed");

    const response = await POST(
      new Request("http://localhost/api/users", {
        method: "POST",
        headers: {
          Cookie: `dev_user_id=${admin.userId}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username: "new_user_sec002",
          email: "new-user-sec002@example.com",
          isActive: true
        })
      })
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toHaveProperty("userId");
  });
});
