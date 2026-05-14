import { beforeEach, describe, expect, it } from "vitest";
import { evaluateAdminUsersRouteAccess } from "@/lib/auth/admin-access";
import { getRuntimeRepositories } from "@/infrastructure/persistence/runtime/repositories";
import {
  createSessionUser,
  resetAuthIntegrationState
} from "./auth-test-helpers";
import { POST as updateDenominatorRulesPreview } from "@/app/api/filters/denominator/[appId]/preview/route";

describe("integration - role route and action authorization", () => {
  beforeEach(() => {
    resetAuthIntegrationState();
  });

  it("redirects/denies non-admin users for admin route access", async () => {
    const repositories = getRuntimeRepositories();
    const ownerUserId = await createSessionUser({ role: "application_owner" });

    const unauthenticated = await evaluateAdminUsersRouteAccess(
      new Request("http://localhost/admin/users"),
      repositories
    );
    expect(unauthenticated.status).toBe(302);

    const ownerAccess = await evaluateAdminUsersRouteAccess(
      new Request("http://localhost/admin/users", {
        headers: { Authorization: `Bearer ${ownerUserId}` }
      }),
      repositories
    );
    expect(ownerAccess.status).toBe(403);
  });

  it("enforces viewer denied / owner allowed behavior for denominator preview writes", async () => {
    const appId = "10000000-0000-0000-0000-000000000005";
    const viewerUserId = await createSessionUser({ role: "viewer", applicationIds: [appId] });
    const ownerUserId = await createSessionUser({ role: "application_owner", applicationIds: [appId] });

    const viewerResponse = await updateDenominatorRulesPreview(
      new Request(`http://localhost/api/filters/denominator/${appId}/preview`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${viewerUserId}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rules: [],
          adoptionLevel: "engagement",
          revenueBasis: "etd"
        })
      }),
      { params: Promise.resolve({ appId }) }
    );

    const ownerResponse = await updateDenominatorRulesPreview(
      new Request(`http://localhost/api/filters/denominator/${appId}/preview`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ownerUserId}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rules: [],
          adoptionLevel: "engagement",
          revenueBasis: "etd"
        })
      }),
      { params: Promise.resolve({ appId }) }
    );

    expect(viewerResponse.status).toBe(403);
    expect(ownerResponse.status).toBe(200);
  });
});
