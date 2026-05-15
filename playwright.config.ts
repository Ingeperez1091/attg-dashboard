import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "@playwright/test";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const dashboardStoreFile = path.resolve(rootDir, "tests/e2e/dashboard/.tmp/dashboard-usage-store.json");

export default defineConfig({
  testDir: path.resolve(rootDir, "tests/e2e"),
  timeout: 30000,
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: "http://localhost:3001",
    headless: true,
    trace: "retain-on-failure"
  },
  webServer: {
    command: `powershell -NoProfile -ExecutionPolicy Bypass -Command "$env:USE_INMEMORY_REPOSITORY='true'; $env:DEV_SESSION_USER_ID='0000-0000-0000-0000-000000000001'; $env:PLAYWRIGHT_TEST='true'; $env:TEST_DASHBOARD_USAGE_REPOSITORY_STORE_FILE='${dashboardStoreFile.replace(/\\/g, "\\\\")}'; npx next dev src/frontend -p 3001 --webpack"`,
    url: "http://localhost:3001",
    timeout: 120000,
    reuseExistingServer: true
  }
});