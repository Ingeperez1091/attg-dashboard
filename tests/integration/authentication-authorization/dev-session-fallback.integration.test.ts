import { beforeEach, describe, expect, it } from "vitest";
import { evaluateAdminUsersRouteAccess } from "@/lib/auth/admin-access";
import { getRuntimeRepositories } from "@/infrastructure/persistence/runtime/repositories";
import { getOptionalSession } from "@/lib/auth/session";
import { resetAuthIntegrationState } from "./auth-test-helpers";

describe("integration - dev session fallback", () => {
  beforeEach(() => {
    resetAuthIntegrationState();
  });

  it("uses the seeded super-admin as the non-production fallback session", async () => {
    process.env.NODE_ENV = "test";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";

    const repositories = getRuntimeRepositories();
    const session = await getOptionalSession(new Request("http://localhost/admin/users"), repositories);

    expect(session?.userId).toBe("30000000-0000-0000-0000-000000000001");
    expect(session?.role).toBe("administrator");
    expect(session?.applications).toContain("*");

    const access = await evaluateAdminUsersRouteAccess(repositories);
    expect(access.status).toBe(200);
  });

  it("ignores DEV_SESSION_USER_ID in production mode", async () => {
    process.env.NODE_ENV = "production";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";

    const repositories = getRuntimeRepositories();
    const session = await getOptionalSession(new Request("http://localhost/admin/users"), repositories);

    expect(session).toBeNull();
  });
});
