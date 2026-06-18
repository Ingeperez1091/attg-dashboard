import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import {
  getRuntimeRepositories,
  getRuntimeConfigEditSessionRepository,
  resetRuntimeRepositoriesForTests,
} from "@/infrastructure/persistence/runtime/repositories";

// We will import the route handlers once created (T040)
// For now we test through the route handler contract
import { POST, PATCH, DELETE } from "@/app/api/filters/[scope]/[appId]/edit-session/route";

describe("contract - edit session lifecycle", () => {
  const appId = "10000000-0000-0000-0000-000000000001";
  const scope = "denominator";

  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function createSessionUser(
    role: "administrator" | "application_owner" | "viewer",
    assignedAppId?: string
  ): Promise<string> {
    const repositories = getRuntimeRepositories();
    const user = await repositories.users.create({
      username: `${role}_${Date.now()}`,
      email: `${role}_${Date.now()}@example.com`,
      isActive: true,
      actorUserId: "seed",
    });
    await repositories.roles.assignRole(user.userId, role, "seed");
    if (assignedAppId) {
      await repositories.userApplications.assign(user.userId, assignedAppId, "seed");
    }
    return user.userId;
  }

  function makePostRequest(userId?: string) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (userId) headers["Cookie"] = `dev_user_id=${userId}`;
    return new Request(
      `http://localhost/api/filters/${scope}/${appId}/edit-session`,
      { method: "POST", headers }
    );
  }

  function makePatchRequest(sessionId: string, userId?: string) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (userId) headers["Cookie"] = `dev_user_id=${userId}`;
    return new Request(
      `http://localhost/api/filters/${scope}/${appId}/edit-session`,
      { method: "PATCH", headers, body: JSON.stringify({ sessionId }) }
    );
  }

  function makeDeleteRequest(sessionId: string, userId?: string) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (userId) headers["Cookie"] = `dev_user_id=${userId}`;
    return new Request(
      `http://localhost/api/filters/${scope}/${appId}/edit-session`,
      { method: "DELETE", headers, body: JSON.stringify({ sessionId }) }
    );
  }

  describe("POST — register session", () => {
    it("returns 201 with session details for application_owner", async () => {
      const userId = await createSessionUser("application_owner", appId);

      const response = await POST(makePostRequest(userId), {
        params: Promise.resolve({ scope, appId }),
      });

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.sessionId).toBeDefined();
      expect(body.applicationId).toBe(appId);
      expect(body.ruleScope).toBe("Denominator");
      expect(body.userId).toBe(userId);
      expect(body.sessionStart).toBeDefined();
      expect(body.lastHeartbeat).toBeDefined();
    });

    it("returns 201 for administrator with app assignment", async () => {
      const userId = await createSessionUser("administrator", appId);

      const response = await POST(makePostRequest(userId), {
        params: Promise.resolve({ scope, appId }),
      });

      expect(response.status).toBe(201);
    });

    it("returns 403 for viewer role", async () => {
      const userId = await createSessionUser("viewer", appId);

      const response = await POST(makePostRequest(userId), {
        params: Promise.resolve({ scope, appId }),
      });

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe("Forbidden");
      expect(body.message).toContain("Viewers cannot register edit sessions");
    });

    it("returns 409 when user already has an active session", async () => {
      const userId = await createSessionUser("application_owner", appId);

      // Register first session
      const first = await POST(makePostRequest(userId), {
        params: Promise.resolve({ scope, appId }),
      });
      expect(first.status).toBe(201);
      const firstBody = await first.json();

      // Attempt to register second session
      const second = await POST(makePostRequest(userId), {
        params: Promise.resolve({ scope, appId }),
      });
      expect(second.status).toBe(409);
      const secondBody = await second.json();
      expect(secondBody.error).toBe("SESSION_EXISTS");
      expect(secondBody.details.existingSessionId).toBe(firstBody.sessionId);
    });
  });

  describe("PATCH — heartbeat", () => {
    it("returns 200 with updated lastHeartbeat", async () => {
      const userId = await createSessionUser("application_owner", appId);

      const reg = await POST(makePostRequest(userId), {
        params: Promise.resolve({ scope, appId }),
      });
      const { sessionId } = await reg.json();

      const response = await PATCH(makePatchRequest(sessionId, userId), {
        params: Promise.resolve({ scope, appId }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.sessionId).toBe(sessionId);
      expect(body.lastHeartbeat).toBeDefined();
    });

    it("returns 404 for non-existent session", async () => {
      const userId = await createSessionUser("application_owner", appId);

      const response = await PATCH(
        makePatchRequest("00000000-0000-0000-0000-000000000099", userId),
        { params: Promise.resolve({ scope, appId }) }
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toBe("NotFound");
    });
  });

  describe("DELETE — release session", () => {
    it("returns 204 on successful release", async () => {
      const userId = await createSessionUser("application_owner", appId);

      const reg = await POST(makePostRequest(userId), {
        params: Promise.resolve({ scope, appId }),
      });
      const { sessionId } = await reg.json();

      const response = await DELETE(makeDeleteRequest(sessionId, userId), {
        params: Promise.resolve({ scope, appId }),
      });

      expect(response.status).toBe(204);
    });

    it("returns 404 for non-existent session", async () => {
      const userId = await createSessionUser("application_owner", appId);

      const response = await DELETE(
        makeDeleteRequest("00000000-0000-0000-0000-000000000099", userId),
        { params: Promise.resolve({ scope, appId }) }
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toBe("NotFound");
    });
  });

  describe("stale session expiry", () => {
    it("excludes stale sessions from activeEditors", async () => {
      vi.useFakeTimers();

      const userId = await createSessionUser("application_owner", appId);

      // Register session
      const reg = await POST(makePostRequest(userId), {
        params: Promise.resolve({ scope, appId }),
      });
      expect(reg.status).toBe(201);

      // Advance time beyond 5-minute stale threshold
      vi.advanceTimersByTime(6 * 60 * 1000);

      // Check active editors — stale session should be excluded
      const repo = getRuntimeConfigEditSessionRepository();
      const editors = await repo.getActiveEditors(appId, "Denominator");
      expect(editors).toHaveLength(0);
    });
  });
});
