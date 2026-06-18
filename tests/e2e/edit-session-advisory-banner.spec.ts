import { expect, test } from "@playwright/test";
import { loginAsProvisionedDevAdmin } from "./helpers/auth";

test.describe("edit session advisory banner e2e", () => {
  const appId = "10000000-0000-0000-0000-000000000001";

  test("shows advisory banner when another editor is active and hides it on release", async ({
    page,
    context,
  }) => {
    // User A opens edit mode
    await loginAsProvisionedDevAdmin(page);
    await page.goto(`/filters/denominator`);

    // Select application and enter edit mode
    await page.locator("#denominator-app-select").selectOption(appId);
    await expect(page.getByRole("button", { name: /edit rules/i })).toBeVisible();
    await page.getByRole("button", { name: /edit rules/i }).click();

    // User B opens the same configuration in a second tab
    const page2 = await context.newPage();
    await loginAsProvisionedDevAdmin(page2);
    await page2.goto(`/filters/denominator`);
    await page2.locator("#denominator-app-select").selectOption(appId);

    // User B should see an advisory warning about another active editor
    const advisory = page2.getByTestId("active-editors-warning");
    await expect(advisory).toBeVisible({ timeout: 5000 });
    await expect(advisory).toContainText(/currently editing/i);

    // User A cancels/leaves edit mode (releases session)
    await page.getByRole("button", { name: /cancel/i }).click();

    // Wait for release to propagate
    await page.waitForTimeout(500);

    // User B re-selects to trigger fresh data load (select empty then re-select)
    await page2.locator("#denominator-app-select").selectOption("");
    await page2.locator("#denominator-app-select").selectOption(appId);

    // Advisory banner should no longer be visible
    await expect(page2.getByTestId("active-editors-warning")).not.toBeVisible({ timeout: 5000 });
  });

  test("advisory banner not shown when user is the only editor", async ({ page }) => {
    await loginAsProvisionedDevAdmin(page);
    await page.goto(`/filters/denominator`);
    await page.locator("#denominator-app-select").selectOption(appId);

    // No other editors — banner should not exist
    await expect(page.getByTestId("active-editors-warning")).not.toBeVisible();
  });

  test("preview button visible in edit mode with active session", async ({ page }) => {
    await loginAsProvisionedDevAdmin(page);
    await page.goto(`/filters/denominator`);
    await page.locator("#denominator-app-select").selectOption(appId);
    await page.getByRole("button", { name: /edit rules/i }).click();

    // Preview Impact button should be visible while in edit mode
    await expect(page.getByRole("button", { name: /preview impact/i })).toBeVisible();
  });
});
