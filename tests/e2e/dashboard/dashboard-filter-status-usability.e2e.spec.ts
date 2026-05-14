import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { loginAsProvisionedDevAdmin } from "../helpers/auth";

const dashboardStoreFile = path.resolve(process.cwd(), "tests/e2e/dashboard/.tmp/dashboard-usage-store.json");

function seedDashboardStore(): void {
  mkdirSync(path.dirname(dashboardStoreFile), { recursive: true });
  writeFileSync(
    dashboardStoreFile,
    JSON.stringify({
      rows: [
        {
          snapshotId: "snap-usability-1",
          runId: "70000000-0000-0000-0000-000000000601",
          applicationId: "10000000-0000-0000-0000-000000000001",
          applicationName: "Maestro",
          subServiceLine: "BTS",
          calculationDate: "2026-05-07T12:00:00.000Z",
          refreshTimestamp: "2026-05-07T12:00:01.000Z",
          metricDefinitionVersion: "EPIC-007-v1",
          denominatorCount: 120,
          numeratorCount: 100,
          matchedCount: 100,
          adoptionPct: 83.33,
          denominatorRevenue: 1500,
          numeratorRevenue: 1200,
          revenuePct: 80,
          avgEngagement: 86,
          investmentAmount: 14
        },
        {
          snapshotId: "snap-usability-2",
          runId: "70000000-0000-0000-0000-000000000601",
          applicationId: "10000000-0000-0000-0000-000000000003",
          applicationName: "Vector",
          subServiceLine: "Indirect Tax",
          calculationDate: "2026-05-07T12:00:00.000Z",
          refreshTimestamp: "2026-05-07T12:00:01.000Z",
          metricDefinitionVersion: "EPIC-007-v1",
          denominatorCount: 110,
          numeratorCount: 45,
          matchedCount: 45,
          adoptionPct: 40.91,
          denominatorRevenue: 1000,
          numeratorRevenue: 350,
          revenuePct: 35,
          avgEngagement: 41,
          investmentAmount: 7
        }
      ],
      runContext: {
        latestCompletedRunId: "70000000-0000-0000-0000-000000000601",
        activeRun: null
      }
    }),
    "utf8"
  );
}

test.describe("dashboard e2e - filter and status usability", () => {
  test.beforeEach(async ({ page }) => {
    seedDashboardStore();
    await loginAsProvisionedDevAdmin(page);
  });

  test("filters to a selected sub service line and exposes the expected status on first interaction", async ({ page }) => {
    await page.goto("/dashboard");

    await page.getByRole("tab", { name: "Indirect Tax" }).click();

    await expect(page.getByRole("tab", { name: "Indirect Tax" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Vector")).toBeVisible();
    await expect(page.getByText("Below Target")).toBeVisible();
    await expect(page.getByText("Maestro")).not.toBeVisible();
  });
});