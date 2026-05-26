import { describe, expect, it, vi } from "vitest";
import { resolveDashboardScope, assertDashboardRunInScope } from "@/lib/auth/dashboardScope";

describe("dashboardScope - uncovered branches", () => {
  it("throws 403 for inactive user and logs the denial", () => {
    const logger = vi.spyOn(console, "info").mockImplementation(() => undefined);

    expect(() =>
      resolveDashboardScope(
        {
          userId: "inactive-user",
          role: "viewer",
          isActive: false,
          applications: ["app-1"]
        },
        {
          availableApplicationIds: ["app-1", "app-2"]
        }
      )
    ).toThrow("User is inactive.");

    expect(logger).toHaveBeenCalledWith(
      expect.stringContaining("inactive_user")
    );
    logger.mockRestore();
  });

  it("normalizes null selectedSubServiceLine to null in successful scope", () => {
    const scope = resolveDashboardScope(
      {
        userId: "viewer-user",
        role: "viewer",
        isActive: true,
        applications: ["app-1"]
      },
      {
        availableApplicationIds: ["app-1"],
        selectedSubServiceLine: null
      }
    );

    expect(scope.selectedSubServiceLine).toBeNull();
  });

  it("trims whitespace-only selectedSubServiceLine to null", () => {
    const scope = resolveDashboardScope(
      {
        userId: "viewer-user",
        role: "viewer",
        isActive: true,
        applications: ["app-1"]
      },
      {
        availableApplicationIds: ["app-1"],
        selectedSubServiceLine: "   "
      }
    );

    expect(scope.selectedSubServiceLine).toBeNull();
  });

  describe("assertDashboardRunInScope", () => {
    it("throws when applicationId is not in scope", () => {
      const scope = {
        userId: "user-1",
        role: "viewer" as const,
        applicationIds: ["app-1"],
        selectedSubServiceLine: null
      };

      expect(() => assertDashboardRunInScope(scope, "app-2")).toThrow(
        "Insufficient permissions to access the requested run."
      );
    });

    it("does not throw when applicationId is in scope", () => {
      const scope = {
        userId: "user-1",
        role: "viewer" as const,
        applicationIds: ["app-1", "app-2"],
        selectedSubServiceLine: null
      };

      expect(() => assertDashboardRunInScope(scope, "app-2")).not.toThrow();
    });
  });
});
