import { expect, type Page } from "@playwright/test";

function uniqueToken(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export async function loginAsProvisionedDevAdmin(page: Page): Promise<void> {
  const token = uniqueToken();
  const email = `e2e-admin-${token}@example.com`;
  const username = `e2e_admin_${token}`;

  const createResponse = await page.request.post("/api/admin/users", {
    data: {
      username,
      email,
      isActive: true,
      roleId: "administrator",
      applicationIds: []
    }
  });

  expect(createResponse.ok()).toBe(true);

  await page.goto("/login");
  await page.getByLabel("Account Identifier").fill(email);
  await page.getByRole("button", { name: "Login (Dev Only)" }).click();
  await expect(page).toHaveURL(/\/$/);
}
