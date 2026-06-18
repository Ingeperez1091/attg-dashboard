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
        headers: { Cookie: `dev_user_id=${viewerUserId}` }
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
          Cookie: `dev_user_id=${ownerUserId}`,
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

    const validPreviewBody = {
      rules: [
        {
          denominatorModelId: "50000000-0000-0000-0007-000000000000",
          operator: "EQUALS",
          value: "11420"
        }
      ]
    };

    const viewerResponse = await updateDenominatorRulesPreview(
      new Request(`http://localhost/api/filters/denominator/${appId}/preview`, {
        method: "POST",
        headers: {
          Cookie: `dev_user_id=${viewerUserId}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(validPreviewBody)
      }),
      { params: Promise.resolve({ appId }) }
    );

    expect(viewerResponse.status).toBe(403);

    const ownerResponse = await updateDenominatorRulesPreview(
      new Request(`http://localhost/api/filters/denominator/${appId}/preview`, {
        method: "POST",
        headers: {
          Cookie: `dev_user_id=${ownerUserId}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(validPreviewBody)
      }),
      { params: Promise.resolve({ appId }) }
    );

    // SSE stream returns 200 with text/event-stream for authorized users
    expect(ownerResponse.status).toBe(200);
    expect(ownerResponse.headers.get("Content-Type")).toBe("text/event-stream");
  });
});
