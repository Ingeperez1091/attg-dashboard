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

  // Get the userId from the creation response to set the cookie directly
  const createdUser = await createResponse.json();
  const userId = createdUser.userId;

  // Set the dev_user_id cookie in the browser context. This simulates the
  // dev-login flow without the redirect-cookie race condition.
  await page.context().addCookies([
    {
      name: "dev_user_id",
      value: userId,
      url: "http://localhost:3001"
    }
  ]);

  // Navigate to `/` — the SessionProvider will call /api/auth/session-token
  // which sees the dev_user_id cookie and issues a Bearer token.
  await page.goto("/");
  // Wait for the AuthGuard to resolve (SessionProvider acquires token)
  await page.waitForFunction(() => {
    return !document.querySelector(".auth-guard-loading");
  }, { timeout: 15000 });

  // If we got redirected to login (session acquisition failed), retry once
  if (page.url().includes("/login")) {
    await page.goto("/");
    await page.waitForFunction(() => {
      return !document.querySelector(".auth-guard-loading");
    }, { timeout: 15000 });
  }
}
