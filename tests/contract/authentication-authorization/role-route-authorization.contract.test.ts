import { beforeEach, describe, expect, it } from "vitest";
import { GET as listAdminUsers } from "@/app/api/admin/users/route";
import { PUT as updateRole } from "@/app/api/admin/users/[userId]/role/route";
import { POST as updateDenominatorRulesPreview } from "@/app/api/filters/denominator/[appId]/preview/route";
import { createSessionUser, resetAuthContractState } from "./auth-test-helpers";
import { getRuntimeRepositories } from "@/infrastructure/persistence/runtime/repositories";

describe("contract - role and route authorization", () => {
  beforeEach(() => {
    resetAuthContractState();
  });

  it("denies viewer access to admin user APIs with 403", async () => {
    const viewerUserId = await createSessionUser({ role: "viewer" });

    const response = await listAdminUsers(
      new Request("http://localhost/api/admin/users", {
        method: "GET",
        headers: { Authorization: `Bearer ${viewerUserId}` }
      })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: "FORBIDDEN" });
  });

  it("denies application owners from assigning roles", async () => {
    const repositories = getRuntimeRepositories();
    const ownerUserId = await createSessionUser({ role: "application_owner" });
    const targetUser = await repositories.users.create({
      username: `target_${Date.now()}`,
      email: `target_${Date.now()}@example.com`,
      isActive: true,
      actorUserId: "seed"
    });

    const response = await updateRole(
      new Request(`http://localhost/api/admin/users/${targetUser.userId}/role`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${ownerUserId}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ roleId: "administrator" })
      }),
      { params: Promise.resolve({ userId: targetUser.userId }) }
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: "FORBIDDEN" });
  });

  it("denies viewer filter preview writes and allows application owners", async () => {
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

    expect(viewerResponse.status).toBe(403);

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

    expect(ownerResponse.status).toBe(200);
  });
});
