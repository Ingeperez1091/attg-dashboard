import { beforeEach, describe, expect, it } from "vitest";
import { evaluateAdminUsersRouteAccess } from "@/lib/auth/admin-access";
import { getRuntimeRepositories } from "@/infrastructure/persistence/runtime/repositories";
import {
  bearerHeaders,
  createSessionUser,
  resetAuthIntegrationState
} from "./auth-test-helpers";
import { getSessionUser, getOptionalSession } from "@/lib/auth/session";

describe("integration - session and protected page behavior", () => {
  beforeEach(() => {
    resetAuthIntegrationState();
  });

  it("redirects unauthenticated access to admin users route", async () => {
    const repositories = getRuntimeRepositories();
    const access = await evaluateAdminUsersRouteAccess(new Request("http://localhost/admin/users"), repositories);

    expect(access.status).toBe(302);
    expect(access.redirectTo).toBe("/login?returnUrl=/admin/users");
  });

  it("allows authenticated administrator access to admin users route", async () => {
    const repositories = getRuntimeRepositories();
    const adminUserId = await createSessionUser({ role: "administrator" });

    const access = await evaluateAdminUsersRouteAccess(
      new Request("http://localhost/admin/users", { headers: bearerHeaders(adminUserId) }),
      repositories
    );

    expect(access.status).toBe(200);
  });

  it("resolves authenticated session and returns null when unauthenticated", async () => {
    const repositories = getRuntimeRepositories();
    const ownerUserId = await createSessionUser({
      role: "application_owner",
      applicationIds: ["10000000-0000-0000-0000-000000000001"]
    });

    const resolved = await getSessionUser(
      new Request("http://localhost/api/metrics/10000000-0000-0000-0000-000000000001", {
        headers: bearerHeaders(ownerUserId)
      }),
      repositories
    );
    expect(resolved.userId).toBe(ownerUserId);
    expect(resolved.role).toBe("application_owner");

    const optional = await getOptionalSession(new Request("http://localhost/api/metrics/10000000-0000-0000-0000-000000000001"), repositories);
    expect(optional).toBeNull();
  });
});
