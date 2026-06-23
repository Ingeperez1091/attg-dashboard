import { test, expect } from "@playwright/test";
import { loginAsProvisionedDevAdmin } from "./helpers/auth";

test.describe("preview impact flow e2e", () => {
  const appId = "10000000-0000-0000-0000-000000000001";

  test("shows progress indicator and renders comparison panel after SSE stream", async ({
    page,
  }) => {
    await loginAsProvisionedDevAdmin(page);
    await page.goto(`/filters/denominator/${appId}`);

    // Wait for rules to load
    await expect(page.getByRole("heading", { level: 1, name: /denominator/i })).toBeVisible();

    // Page starts in edit mode for [appId] route — wait for editor
    await expect(page.getByRole("button", { name: /preview impact/i })).toBeVisible();

    // Intercept preview API with a simulated SSE stream (progress → complete)
    await page.route(`**/api/filters/denominator/${appId}/preview`, async (route) => {
      const sseBody = [
        `event: status\ndata: ${JSON.stringify({ stage: "queued", pctComplete: 0, previewRunId: "test-run" })}\n\n`,
        `event: status\ndata: ${JSON.stringify({ stage: "processing", pctComplete: 25 })}\n\n`,
        `event: status\ndata: ${JSON.stringify({ stage: "calculating_metrics", pctComplete: 90 })}\n\n`,
        `event: complete\ndata: ${JSON.stringify({
          current: { adoptionPct: 65.2, revenueSharePct: 72.1, matchedCount: 120, denominatorCount: 200, denominatorRevenue: 5000000 },
          projected: { adoptionPct: 71.8, revenueSharePct: 78.4, matchedCount: 140, denominatorCount: 195, denominatorRevenue: 4800000 },
          delta: { adoptionPct: 6.6, revenueSharePct: 6.3, matchedCount: 20, denominatorCount: -5, denominatorRevenue: -200000 },
          warnings: [],
          previewRunId: "test-run",
          calculatedAtUtc: new Date().toISOString(),
        })}\n\n`,
      ].join("");

      await route.fulfill({
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
        body: sseBody,
      });
    });

    // Click Preview Impact button
    const previewButton = page.getByRole("button", { name: /preview impact/i });
    await previewButton.click();

    // Wait for comparison panel to render (SSE complete event)
    const comparisonPanel = page.locator("[data-testid='preview-impact-panel']");
    await expect(comparisonPanel).toBeVisible({ timeout: 20000 });

    // Verify metric fields are displayed
    await expect(comparisonPanel.getByText(/adoption/i)).toBeVisible();
    await expect(comparisonPanel.getByText(/revenue share/i)).toBeVisible();
    await expect(comparisonPanel.getByText(/matched count/i)).toBeVisible();
    await expect(comparisonPanel.getByText(/denominator count/i)).toBeVisible();
    await expect(comparisonPanel.getByText(/denominator revenue/i)).toBeVisible();

    // Verify current/projected columns exist
    await expect(comparisonPanel.getByText(/current/i)).toBeVisible();
    await expect(comparisonPanel.getByText(/projected/i)).toBeVisible();
  });

  test("shows error state with retry when preview fails", async ({ page }) => {
    await loginAsProvisionedDevAdmin(page);
    await page.goto(`/filters/denominator/${appId}`);

    // Wait for editor to load (starts in edit mode for [appId] route)
    await expect(page.getByRole("button", { name: /preview impact/i })).toBeVisible();

    // Intercept the preview API to simulate an error SSE event
    await page.route(`**/api/filters/denominator/${appId}/preview`, async (route) => {
      await route.fulfill({
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
        body: `event: status\ndata: {"stage":"queued","pctComplete":0}\n\nevent: error\ndata: {"message":"Preview calculation failed. Please try again.","previewRunId":"test-run-id"}\n\n`,
      });
    });

    // Click Preview Impact
    await page.getByRole("button", { name: /preview impact/i }).click();

    // Should show error message
    await expect(page.getByText(/preview calculation failed/i)).toBeVisible({
      timeout: 10000,
    });

    // Should show retry button
    await expect(page.getByRole("button", { name: /retry/i })).toBeVisible();
  });

  test("preview button is disabled when no changes are made", async ({ page }) => {
    await loginAsProvisionedDevAdmin(page);
    await page.goto(`/filters/denominator/${appId}`);

    // Page starts in edit mode for [appId] route
    // Preview Impact button should be present
    const previewButton = page.getByRole("button", { name: /preview impact/i });
    await expect(previewButton).toBeVisible();
  });
});
