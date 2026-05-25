import { describe, expect, it, vi } from "vitest";
import { logUserCreateFailure, logUserCreateSuccess, logSsoIdentityBindSuccess } from "@/lib/api/audit-logger";

describe("audit-logger - branch coverage", () => {
  it("logUserCreateFailure handles null payload", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logUserCreateFailure("Validation failed.", "admin-1", null);

    expect(spy).toHaveBeenCalledOnce();
    const logged = spy.mock.calls[0][0] as string;
    expect(logged).toContain("create_failed");
    expect(logged).toContain("Validation failed.");

    spy.mockRestore();
  });

  it("logUserCreateFailure handles string payload", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logUserCreateFailure("Bad input", "admin-1", "raw string payload");

    expect(spy).toHaveBeenCalledOnce();
    const logged = spy.mock.calls[0][0] as string;
    expect(logged).toContain("create_failed");

    spy.mockRestore();
  });

  it("logUserCreateFailure handles object payload with non-string fields", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logUserCreateFailure("Type error", "admin-1", {
      username: 123,
      email: null,
      displayName: undefined
    });

    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  it("logUserCreateFailure handles valid object payload", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logUserCreateFailure("Duplicate", "admin-1", {
      username: "test_user",
      email: "test@example.com",
      displayName: "Test User"
    });

    expect(spy).toHaveBeenCalledOnce();
    const logged = spy.mock.calls[0][0] as string;
    expect(logged).toContain("test_user");
    expect(logged).toContain("test@example.com");

    spy.mockRestore();
  });

  it("logUserCreateSuccess writes info audit", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logUserCreateSuccess("user-1", "user@example.com", "admin-1");

    expect(spy).toHaveBeenCalledOnce();
    const logged = spy.mock.calls[0][0] as string;
    expect(logged).toContain('"action":"create"');

    spy.mockRestore();
  });

  it("logSsoIdentityBindSuccess writes info audit", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logSsoIdentityBindSuccess("user-1", "user@example.com", "oid-123");

    expect(spy).toHaveBeenCalledOnce();
    const logged = spy.mock.calls[0][0] as string;
    expect(logged).toContain("sso_identity_bind");

    spy.mockRestore();
  });
});
