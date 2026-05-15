import { describe, expect, it, vi } from "vitest";
import { validateRuntimeSecurityConfig } from "@/lib/security/runtime-security";

describe("runtime security config validation", () => {
  it("does not throw in development when dev bypass is available", () => {
    const infoLogger = vi.spyOn(console, "info").mockImplementation(() => undefined);

    expect(() =>
      validateRuntimeSecurityConfig({
        NODE_ENV: "development",
        ENABLE_DEV_BYPASS: "true",
        DEV_SESSION_USER_ID: "30000000-0000-0000-0000-000000000001"
      })
    ).not.toThrow();

    expect(infoLogger).toHaveBeenCalled();
    infoLogger.mockRestore();
  });

  it("throws in production when ENABLE_DEV_BYPASS=true", () => {
    const errorLogger = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() =>
      validateRuntimeSecurityConfig({
        NODE_ENV: "production",
        ENABLE_DEV_BYPASS: "true"
      })
    ).toThrow("Invalid production security configuration: ENABLE_DEV_BYPASS=true");

    expect(errorLogger).toHaveBeenCalled();
    errorLogger.mockRestore();
  });

  it("throws in production when DEV_SESSION_USER_ID is set", () => {
    const errorLogger = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() =>
      validateRuntimeSecurityConfig({
        NODE_ENV: "production",
        DEV_SESSION_USER_ID: "30000000-0000-0000-0000-000000000001"
      })
    ).toThrow("Invalid production security configuration: DEV_SESSION_USER_ID is set");

    expect(errorLogger).toHaveBeenCalled();
    errorLogger.mockRestore();
  });
});
