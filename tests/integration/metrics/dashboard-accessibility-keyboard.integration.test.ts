import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveDashboardFilterNavigation } from "@/app/components/dashboard/dashboardAccessibility";

const filterBarPath = path.resolve(process.cwd(), "src/frontend/app/components/dashboard/DashboardFilterBar.tsx");
const detailPanelPath = path.resolve(process.cwd(), "src/frontend/app/components/dashboard/DashboardDetailPanel.tsx");

describe("dashboard integration - keyboard accessibility", () => {
  it("moves the selected filter with arrow, home, and end keys", () => {
    const filters = ["All", "BTS", "Indirect Tax"];

    expect(resolveDashboardFilterNavigation(filters, "All", "ArrowRight")).toBe("BTS");
    expect(resolveDashboardFilterNavigation(filters, "BTS", "ArrowLeft")).toBe("All");
    expect(resolveDashboardFilterNavigation(filters, "All", "End")).toBe("Indirect Tax");
    expect(resolveDashboardFilterNavigation(filters, "Indirect Tax", "Home")).toBe("All");
    expect(resolveDashboardFilterNavigation(filters, "BTS", "Enter")).toBeNull();
  });

  it("defines tab semantics for the filter bar and connects the active tab to the detail panel", () => {
    const source = readFileSync(filterBarPath, "utf8");

    expect(source).toContain('role="tablist"');
    expect(source).toContain('aria-controls="dashboard-detail-panel"');
    expect(source).toContain('aria-selected={active}');
    expect(source).toContain('tabIndex={active ? 0 : -1}');
    expect(source).toContain('onKeyDown={(event) => void handleKeyDown(event, filter)}');
  });

  it("defines the grouped detail panel as the controlled tabpanel with labeled group content", () => {
    const source = readFileSync(detailPanelPath, "utf8");

    expect(source).toContain('id="dashboard-detail-panel"');
    expect(source).toContain('role="tabpanel"');
    expect(source).toContain('aria-labelledby={toDashboardFilterTabId(activeFilter)}');
    expect(source).toContain('role="group"');
    expect(source).toContain('role="list"');
    expect(source).toContain('role="listitem"');
    expect(source).toContain('aria-label={`${child.displayName} status ${child.metrics.status}`}');
  });
});