import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "@playwright/test";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const tmpDir = path.resolve(rootDir, "tests/e2e/.tmp");
const dashboardStoreFile = path.resolve(tmpDir, "dashboard-usage-store.json");
const userStoreFile = path.resolve(tmpDir, "user-store.json");
const roleStoreFile = path.resolve(tmpDir, "role-store.json");
const applicationStoreFile = path.resolve(tmpDir, "application-store.json");

export default defineConfig({
  testDir: path.resolve(rootDir, "tests/e2e"),
  timeout: 60000,
  expect: { timeout: 15000 },
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: "http://localhost:3001",
    headless: true,
    trace: "retain-on-failure"
  },
  webServer: {
    command: `powershell -NoProfile -ExecutionPolicy Bypass -Command "$env:USE_INMEMORY_REPOSITORY='true'; $env:DEV_SESSION_USER_ID='0000-0000-0000-0000-000000000001'; $env:PLAYWRIGHT_TEST='true'; $env:AUTH_URL='http://localhost:3001'; $env:TEST_DASHBOARD_USAGE_REPOSITORY_STORE_FILE='${dashboardStoreFile.replaceAll("\\", "\\\\")}'; $env:TEST_USER_REPOSITORY_STORE_FILE='${userStoreFile.replaceAll("\\", "\\\\")}'; $env:TEST_ROLE_REPOSITORY_STORE_FILE='${roleStoreFile.replaceAll("\\", "\\\\")}'; $env:TEST_APPLICATION_REPOSITORY_STORE_FILE='${applicationStoreFile.replaceAll("\\", "\\\\")}'; npx next dev src/frontend -p 3001"`,
    url: "http://localhost:3001",
    timeout: 120000,
    reuseExistingServer: true
  }
});