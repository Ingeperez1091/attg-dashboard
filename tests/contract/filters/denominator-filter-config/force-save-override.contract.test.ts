import { beforeEach, describe, expect, it } from "vitest";
import { PUT } from "@/app/api/filters/denominator/[appId]/route";
import {
  getRuntimeRepositories,
  resetRuntimeRepositoriesForTests,
} from "@/infrastructure/persistence/runtime/repositories";

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

describe("contract - force-save (forceOverride) on denominator PUT", () => {
  const appId = "10000000-0000-0000-0000-000000000001";

  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    delete process.env.DEV_SESSION_USER_ID;
    resetRuntimeRepositoriesForTests();
  });

  function makePutRequest(body: object, userId: string) {
    return new Request(`http://localhost/api/filters/denominator/${appId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: `dev_user_id=${userId}`,
      },
      body: JSON.stringify(body),
    });
  }

  const validRules = [
    {
      denominatorModelId: "50000000-0000-0000-0007-000000000000",
      operator: "EQUALS",
      value: "11300",
    },
  ];

  it("returns 200 for administrator with forceOverride and overrideReason", async () => {
    const adminId = await createSessionUser("administrator", appId);

    const response = await PUT(
      makePutRequest(
        {
          rules: validRules,
          configVersion: 1,
          forceOverride: true,
          overrideReason: "Correcting misconfiguration from batch import.",
        },
        adminId
      ),
      { params: Promise.resolve({ appId }) }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.configVersion).toBe(2);
  });

  it("returns 403 for application_owner with forceOverride", async () => {
    const ownerId = await createSessionUser("application_owner", appId);

    const response = await PUT(
      makePutRequest(
        {
          rules: validRules,
          configVersion: 1,
          forceOverride: true,
          overrideReason: "Should not be allowed.",
        },
        ownerId
      ),
      { params: Promise.resolve({ appId }) }
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("Forbidden");
    expect(body.message).toContain("Force-save is restricted to administrators");
  });

  it("returns 400 when forceOverride is true but overrideReason is missing", async () => {
    const adminId = await createSessionUser("administrator", appId);

    const response = await PUT(
      makePutRequest(
        {
          rules: validRules,
          configVersion: 1,
          forceOverride: true,
          // overrideReason intentionally omitted
        },
        adminId
      ),
      { params: Promise.resolve({ appId }) }
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("VALIDATION_ERROR");
    expect(body.details.code).toBe("MISSING_OVERRIDE_REASON");
  });

  it("force-save succeeds even with stale configVersion", async () => {
    const adminId = await createSessionUser("administrator", appId);

    // First normal save → version becomes 2
    const first = await PUT(
      makePutRequest(
        { rules: validRules, configVersion: 1 },
        adminId
      ),
      { params: Promise.resolve({ appId }) }
    );
    expect(first.status).toBe(200);

    // Force-save with stale version 1 → still succeeds
    const forced = await PUT(
      makePutRequest(
        {
          rules: validRules,
          configVersion: 1,
          forceOverride: true,
          overrideReason: "Emergency fix after another user changed config.",
        },
        adminId
      ),
      { params: Promise.resolve({ appId }) }
    );

    expect(forced.status).toBe(200);
    const body = await forced.json();
    expect(body.configVersion).toBe(3);
  });
});
