import { describe, expect, it, vi } from "vitest";
import { resolveDashboardScope } from "@/lib/auth/dashboardScope";

describe("dashboard scope resolver unit - role scoped behavior", () => {
  it("grants administrators the full available scope", () => {
    const scope = resolveDashboardScope(
      {
        userId: "admin-user",
        role: "administrator",
        isActive: true,
        applications: ["*"]
      },
      {
        availableApplicationIds: ["app-1", "app-2"],
        selectedSubServiceLine: "BTS"
      }
    );

    expect(scope.applicationIds).toEqual(["app-1", "app-2"]);
    expect(scope.selectedSubServiceLine).toBe("BTS");
  });

  it("limits non-admin users to assigned applications only", () => {
    const scope = resolveDashboardScope(
      {
        userId: "viewer-user",
        role: "viewer",
        isActive: true,
        applications: ["app-2", "app-3"]
      },
      {
        availableApplicationIds: ["app-1", "app-2"]
      }
    );

    expect(scope.applicationIds).toEqual(["app-2"]);
  });

  it("throws when the user has no authorized applications and logs the denial", () => {
    const logger = vi.spyOn(console, "info").mockImplementation(() => undefined);

    expect(() =>
      resolveDashboardScope(
        {
          userId: "viewer-user",
          role: "viewer",
          isActive: true,
          applications: ["app-3"]
        },
        {
          availableApplicationIds: ["app-1", "app-2"]
        }
      )
    ).toThrow("No authorized applications found for dashboard scope.");

    expect(logger).toHaveBeenCalled();
    logger.mockRestore();
  });
});