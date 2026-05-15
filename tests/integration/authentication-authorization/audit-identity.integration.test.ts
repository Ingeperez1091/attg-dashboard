import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as createUser } from "@/app/api/admin/users/route";
import { PUT as updateDenominatorFilters } from "@/app/api/filters/denominator/[appId]/route";
import { bearerHeaders, createSessionUser, resetAuthIntegrationState } from "./auth-test-helpers";

describe("integration - audit identity propagation", () => {
  const appId = "10000000-0000-0000-0000-000000000001";

  beforeEach(() => {
    resetAuthIntegrationState();
    vi.restoreAllMocks();
  });

  it("logs actor identity for administrator create and filter writes", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const adminUserId = await createSessionUser({ role: "administrator" });

    const createResponse = await createUser(
      new Request("http://localhost/api/admin/users", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminUserId}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username: `audit_int_${Date.now()}`,
          email: `audit_int_${Date.now()}@example.com`,
          isActive: true
        })
      })
    );
    expect(createResponse.status).toBe(201);

    const ownerUserId = await createSessionUser({ role: "application_owner", applicationIds: [appId] });
    const updateResponse = await updateDenominatorFilters(
      new Request(`http://localhost/api/filters/denominator/${appId}`, {
        method: "PUT",
        headers: {
          ...bearerHeaders(ownerUserId),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rules: [
            {
              denominatorModelId: "50000000-0000-0000-0007-000000000000",
              operator: "EQUALS",
              value: "11300"
            }
          ]
        })
      }),
      { params: Promise.resolve({ appId }) }
    );
    expect(updateResponse.status).toBe(200);

    const serialized = infoSpy.mock.calls.map((args) => String(args[0])).join("\n");
    expect(serialized).toContain('"action":"create"');
    expect(serialized).toContain(`"createdBy":"${adminUserId}"`);
    expect(serialized).toContain('"action":"denominator.filters.update"');
    expect(serialized).toContain(`"actorUserId":"${ownerUserId}"`);
  });
});
