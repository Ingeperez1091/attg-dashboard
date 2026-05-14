import { expect, test } from "@playwright/test";
import { loginAsProvisionedDevAdmin } from "../helpers/auth";

test.describe("app pages e2e - route smoke coverage", () => {
  test("renders home page", async ({ page }) => {
    await loginAsProvisionedDevAdmin(page);

    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Quick Actions" })).toBeVisible();
    await expect(page.getByRole("link", { name: "User Administration" })).toBeVisible();
  });

  test("renders login page", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in with Microsoft Entra ID" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Local Dev Bypass" })).toBeVisible();
  });

  test("renders dashboard page", async ({ page }) => {
    await loginAsProvisionedDevAdmin(page);
    await page.goto("/dashboard");

    await expect(page.getByRole("heading", { name: /product adoption metrics summary/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: "All" })).toBeVisible();
  });

  test("renders numerator filters page", async ({ page }) => {
    await loginAsProvisionedDevAdmin(page);
    await page.goto("/filters/numerator");

    await expect(page.getByRole("heading", { name: "Numerator Filter Configuration" })).toBeVisible();
    await expect(page.getByLabel("Application:")).toBeVisible();
  });

  test("renders denominator filters page", async ({ page }) => {
    await loginAsProvisionedDevAdmin(page);
    await page.goto("/filters/denominator");

    await expect(page.getByRole("heading", { name: "Denominator Filter Configuration" })).toBeVisible();
    await expect(page.getByLabel("Application:")).toBeVisible();
  });

  test("renders user administration page", async ({ page }) => {
    await loginAsProvisionedDevAdmin(page);
    await page.goto("/admin/users");

    await expect(page.getByRole("heading", { name: "User Administration" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add user" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
  });
});
