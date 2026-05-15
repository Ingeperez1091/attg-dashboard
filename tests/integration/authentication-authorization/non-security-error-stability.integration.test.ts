import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getDashboardUsage } from "@/app/api/dashboard/usage/route";
import { GET as getDashboardState } from "@/app/api/dashboard/usage/state/route";
import { getRuntimeDashboardUsageRepository, resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";
import { DashboardUsageMemoryRepository } from "@/infrastructure/persistence/memory/DashboardUsageMemoryRepository";

const TEST_USER_ID = "30000000-0000-0000-0000-000000000001";

describe("integration - non-security error stability", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = TEST_USER_ID;
    resetRuntimeRepositoriesForTests();
    vi.restoreAllMocks();
  });

  it("returns the established dashboard failure envelope when downstream usage retrieval fails", async () => {
    const repository = getRuntimeDashboardUsageRepository();
    if (!(repository instanceof DashboardUsageMemoryRepository)) {
      throw new Error("Expected DashboardUsageMemoryRepository in tests");
    }

    vi.spyOn(repository, "listUsageRows").mockRejectedValueOnce(new Error("boom"));

    const response = await getDashboardUsage(new Request("http://localhost/api/dashboard/usage", { method: "GET" }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("DASHBOARD_DATA_UNAVAILABLE");
    expect(body.state.state).toBe("error");
    expect(body.state.message).toBe("Dashboard data is temporarily unavailable.");
  });

  it("returns the established state failure envelope when downstream state retrieval fails", async () => {
    const repository = getRuntimeDashboardUsageRepository();
    if (!(repository instanceof DashboardUsageMemoryRepository)) {
      throw new Error("Expected DashboardUsageMemoryRepository in tests");
    }

    vi.spyOn(repository, "getRunContext").mockRejectedValueOnce(new Error("boom"));

    const response = await getDashboardState(new Request("http://localhost/api/dashboard/usage/state", { method: "GET" }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("DASHBOARD_DATA_UNAVAILABLE");
    expect(body.message).toBe("Dashboard state is temporarily unavailable.");
  });
});
