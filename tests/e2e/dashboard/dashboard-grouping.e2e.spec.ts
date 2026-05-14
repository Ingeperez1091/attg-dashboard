import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { loginAsProvisionedDevAdmin } from "../helpers/auth";

const dashboardStoreFile = path.resolve(process.cwd(), "tests/e2e/dashboard/.tmp/dashboard-usage-store.json");

function seedDashboardStore(): void {
  mkdirSync(path.dirname(dashboardStoreFile), { recursive: true });
  writeFileSync(
    dashboardStoreFile,
    JSON.stringify({
      rows: [
        {
          snapshotId: "snap-e2e-1",
          runId: "70000000-0000-0000-0000-000000000501",
          applicationId: "10000000-0000-0000-0000-000000000001",
          applicationName: "Maestro",
          subServiceLine: "BTS",
          calculationDate: "2026-05-07T12:00:00.000Z",
          refreshTimestamp: "2026-05-07T12:00:01.000Z",
          metricDefinitionVersion: "EPIC-007-v1",
          denominatorCount: 120,
          numeratorCount: 92,
          matchedCount: 92,
          adoptionPct: 76.67,
          denominatorRevenue: 1200,
          numeratorRevenue: 980,
          revenuePct: 81.67,
          avgEngagement: 83,
          investmentAmount: 15
        },
        {
          snapshotId: "snap-e2e-2",
          runId: "70000000-0000-0000-0000-000000000501",
          applicationId: "10000000-0000-0000-0000-000000000002",
          applicationName: "EYST",
          subServiceLine: "Indirect Tax",
          calculationDate: "2026-05-07T12:00:00.000Z",
          refreshTimestamp: "2026-05-07T12:00:01.000Z",
          metricDefinitionVersion: "EPIC-007-v1",
          denominatorCount: 90,
          numeratorCount: 40,
          matchedCount: 40,
          adoptionPct: 44.44,
          denominatorRevenue: 900,
          numeratorRevenue: 350,
          revenuePct: 38.89,
          avgEngagement: 48,
          investmentAmount: 9
        }
      ],
      runContext: {
        latestCompletedRunId: "70000000-0000-0000-0000-000000000501",
        activeRun: null
      }
    }),
    "utf8"
  );
}

test.describe("dashboard e2e - grouped dashboard sections and hierarchy", () => {
  test.beforeEach(async ({ page }) => {
    seedDashboardStore();
    await loginAsProvisionedDevAdmin(page);
  });

  test("renders the five required sections and grouped hierarchy", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page.getByRole("heading", { name: /product adoption metrics summary/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: "All" })).toBeVisible();
    await expect(page.getByText("BTS").first()).toBeVisible();
    await expect(page.getByText("Indirect Tax").first()).toBeVisible();
    await expect(page.getByText("Maestro")).toBeVisible();
    await expect(page.getByText(/metric definition/i)).toBeVisible();
  });
});