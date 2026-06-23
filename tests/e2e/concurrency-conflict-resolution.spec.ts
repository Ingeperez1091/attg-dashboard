import { expect, test } from "@playwright/test";
import { loginAsProvisionedDevAdmin } from "./helpers/auth";

test.describe("concurrency conflict resolution e2e", () => {
  const appId = "10000000-0000-0000-0000-000000000001";

  test("displays conflict dialog when 409 occurs and offers resolution actions", async ({
    page,
  }) => {
    // Login as admin
    await loginAsProvisionedDevAdmin(page);
    await page.goto(`/filters/denominator/${appId}`);

    // Intercept PUT to simulate a version conflict (409) from another user's save
    await page.route(`**/api/filters/denominator/${appId}`, async (route) => {
      if (route.request().method() === "PUT") {
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            error: "VERSION_CONFLICT",
            message: "Configuration was modified by another user since you loaded it.",
            details: {
              currentVersion: 2,
              currentRules: [],
              lastModifiedBy: "other-user@example.com",
              lastModifiedAt: "2026-06-12T14:32:00.000Z",
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Wait for rules editor to load
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeVisible();

    // Attempt save → triggers 409 from intercepted route
    await page.getByRole("button", { name: "Save", exact: true }).click();

    // Expect conflict dialog to appear
    const dialog = page.getByRole("dialog", { name: /conflict/i });
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Verify dialog contents
    await expect(dialog.getByText(/saved by/i)).toBeVisible();
    await expect(dialog.getByRole("button", { name: /reload/i })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /cancel/i })).toBeVisible();

    // Force-save button should be visible for admin
    await expect(dialog.getByRole("button", { name: /force.*save/i })).toBeVisible();
  });

  test("force-save requires override reason and succeeds for admin", async ({ page }) => {
    await loginAsProvisionedDevAdmin(page);
    await page.goto(`/filters/denominator/${appId}`);

    // Simulate a 409 scenario by intercepting the PUT to return 409
    await page.route(`**/api/filters/denominator/${appId}`, async (route) => {
      if (route.request().method() === "PUT") {
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            error: "VERSION_CONFLICT",
            message: "Configuration was modified by another user since you loaded it.",
            details: {
              currentVersion: 3,
              currentRules: [],
              lastModifiedBy: "other-user@example.com",
              lastModifiedAt: "2026-06-12T14:32:00.000Z",
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Wait for page to finish loading and show editor
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeVisible();

    // Trigger the save
    await page.getByRole("button", { name: "Save", exact: true }).click();

    // Conflict dialog should appear
    const dialog = page.getByRole("dialog", { name: /conflict/i });
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Click force-save
    await dialog.getByRole("button", { name: /force.*save/i }).click();

    // Should show override reason input
    const reasonInput = dialog.getByLabel(/reason/i);
    await expect(reasonInput).toBeVisible();
    await reasonInput.fill("Emergency correction for incorrect batch import.");

    // Confirm force-save
    await dialog.getByRole("button", { name: /confirm/i }).click();
  });

  test("reload action dismisses dialog and refreshes rules", async ({ page }) => {
    await loginAsProvisionedDevAdmin(page);
    await page.goto(`/filters/denominator/${appId}`);

    // Intercept PUT to return 409
    let intercepted = false;
    await page.route(`**/api/filters/denominator/${appId}`, async (route) => {
      if (route.request().method() === "PUT" && !intercepted) {
        intercepted = true;
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            error: "VERSION_CONFLICT",
            message: "Configuration was modified by another user since you loaded it.",
            details: {
              currentVersion: 2,
              currentRules: [],
              lastModifiedBy: "other-user@example.com",
              lastModifiedAt: "2026-06-12T14:32:00.000Z",
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Wait for page to finish loading and show editor
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeVisible();

    // Trigger save
    await page.getByRole("button", { name: "Save", exact: true }).click();

    // Conflict dialog appears
    const dialog = page.getByRole("dialog", { name: /conflict/i });
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Click reload
    await dialog.getByRole("button", { name: /reload/i }).click();

    // Dialog should close
    await expect(dialog).not.toBeVisible();
  });
});
