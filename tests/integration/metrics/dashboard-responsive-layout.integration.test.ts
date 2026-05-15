import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const cssPath = path.resolve(process.cwd(), "src/frontend/app/components/dashboard/dashboard.css");

describe("dashboard integration - responsive layout", () => {
  it("defines tablet and mobile breakpoints for KPI, group, and filter layouts", () => {
    const css = readFileSync(cssPath, "utf8");

    expect(css).toContain("@media (max-width: 1100px)");
    expect(css).toContain(".dashboard-kpi-row {");
    expect(css).toContain("grid-template-columns: repeat(2, minmax(0, 1fr));");
    expect(css).toContain(".dashboard-row {");
    expect(css).toContain("grid-template-columns: 1fr;");

    expect(css).toContain("@media (max-width: 820px)");
    expect(css).toContain(".dashboard-group__rollup {");
    expect(css).toContain("min-width: 0;");
    expect(css).toContain(".dashboard-filter-bar__tabs {");
    expect(css).toContain("width: 100%;");
    expect(css).toContain("flex: 1 1 calc(50% - 8px);");
    expect(css).toContain(".dashboard-meter {");
    expect(css).toContain("grid-template-columns: 1fr;");
  });
});