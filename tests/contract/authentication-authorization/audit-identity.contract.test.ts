import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as createUser } from "@/app/api/admin/users/route";
import { PUT as updateNumeratorFilters } from "@/app/api/filters/numerator/[appId]/route";
import { bearerHeaders, createSessionUser, resetAuthContractState } from "./auth-test-helpers";

describe("contract - audit identity propagation", () => {
  const appId = "10000000-0000-0000-0000-000000000005";

  beforeEach(() => {
    resetAuthContractState();
    vi.restoreAllMocks();
  });

  it("includes the authenticated actor in admin user creation audit logs", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";

    const response = await createUser(
      new Request("http://localhost/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: `audit_user_${Date.now()}`,
          email: `audit_user_${Date.now()}@example.com`,
          isActive: true
        })
      })
    );

    expect(response.status).toBe(201);
    const serialized = infoSpy.mock.calls.map((args) => String(args[0])).join("\n");
    expect(serialized).toContain('"action":"create"');
    expect(serialized).toContain('"createdBy":"30000000-0000-0000-0000-000000000001"');
  });

  it("includes the authenticated actor in filter update mutation logs", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const ownerUserId = await createSessionUser({ role: "application_owner", applicationIds: [appId] });

    const response = await updateNumeratorFilters(
      new Request(`http://localhost/api/filters/numerator/${appId}`, {
        method: "PUT",
        headers: {
          ...bearerHeaders(ownerUserId),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rules: [
            {
              applicationModelFieldId: "40000000-0000-0000-0505-000000000005",
              operator: "GREATER_OR_EQUAL",
              value: "25000"
            }
          ]
        })
      }),
      { params: Promise.resolve({ appId }) }
    );

    expect(response.status).toBe(200);
    const serialized = infoSpy.mock.calls.map((args) => String(args[0])).join("\n");
    expect(serialized).toContain('"action":"numerator.filters.update"');
    expect(serialized).toContain(`"actorUserId":"${ownerUserId}"`);
  });
});
