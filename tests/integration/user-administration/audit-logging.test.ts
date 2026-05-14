import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as createUser } from "@/app/api/admin/users/route";
import { resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";

describe("Phase 8 integration - audit logging", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
    vi.restoreAllMocks();
  });

  it("logs successful user creation audit event", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const response = await createUser(
      new Request("http://localhost/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "audit_success_user",
          email: "audit-success-user@example.com",
          isActive: true
        })
      })
    );

    expect(response.status).toBe(201);

    const logMessage = infoSpy.mock.calls.find((args) => String(args[0]).includes('"action":"create"'));
    expect(logMessage).toBeDefined();
    expect(String(logMessage?.[0])).toContain("audit-success-user@example.com");
    expect(String(logMessage?.[0])).toContain("30000000-0000-0000-0000-000000000001");
  });

  it("logs failed user creation audit event with sanitized payload", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const response = await createUser(
      new Request("http://localhost/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username: "audit_failure_user",
          email: "not-an-email",
          displayName: "Audit Failure",
          sessionToken: "sample-token-should-not-be-logged"
        })
      })
    );

    expect(response.status).toBe(400);

    const logMessage = warnSpy.mock.calls.find((args) => String(args[0]).includes('"action":"create_failed"'));
    expect(logMessage).toBeDefined();

    const serialized = String(logMessage?.[0]);
    expect(serialized).toContain("audit_failure_user");
    expect(serialized).toContain("Audit Failure");
    expect(serialized).not.toContain("sample-token-should-not-be-logged");
  });
});
