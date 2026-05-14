import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/numerator/route";
import { getRuntimeRepositories, resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";
import { resetNumeratorIngestionRepositoryForTests } from "@/infrastructure/persistence/runtime/repositories";

describe("numerator ingestion contract - errors", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
    resetNumeratorIngestionRepositoryForTests();
  });

  it("returns 400 for invalid payload", async () => {
    const request = new Request("http://localhost/api/numerator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicationId: "not-a-uuid",
        payload: []
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("VALIDATION_ERROR");
  });

  it("returns 401 when no session can be resolved", async () => {
    delete process.env.DEV_SESSION_USER_ID;

    const request = new Request("http://localhost/api/numerator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicationId: "10000000-0000-0000-0000-000000000001",
        payload: []
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("UNAUTHORIZED");
  });

  it("returns 403 for viewer role using bearer identity", async () => {
    delete process.env.DEV_SESSION_USER_ID;
    const repositories = getRuntimeRepositories();

    const viewer = await repositories.users.create({
      username: "viewer_user",
      email: "viewer@example.com",
      isActive: true,
      actorUserId: "seed"
    });
    await repositories.roles.assignRole(viewer.userId, "viewer", "seed");

    const request = new Request("http://localhost/api/numerator", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${viewer.userId}`
      },
      body: JSON.stringify({
        applicationId: "10000000-0000-0000-0000-000000000001",
        payload: [{ id: 1 }]
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("FORBIDDEN");
  });
});
