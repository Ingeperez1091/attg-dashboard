import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const cssPath = path.resolve(process.cwd(), "src/frontend/app/components/dashboard/dashboard.css");

describe("dashboard integration - reduced motion", () => {
  it("defines transitions and disables them inside prefers-reduced-motion", () => {
    const css = readFileSync(cssPath, "utf8");

    expect(css).toContain(".dashboard-filter-bar__tab {");
    expect(css).toContain("transition: background-color 160ms ease, color 160ms ease, border-color 160ms ease, transform 160ms ease;");
    expect(css).toContain(".dashboard-group {");
    expect(css).toContain("transition: transform 180ms ease, box-shadow 180ms ease;");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain(".dashboard-state-shell__banner,");
    expect(css).toContain("transition: none;");
  });
});