# Dashboard E2E Evidence

## Purpose

Captures execution evidence for the dashboard Playwright suite used by EPIC-BQM-014 polish tasks.

## Suite

- dashboard-grouping.e2e.spec.ts
- dashboard-filter-status-usability.e2e.spec.ts

## Local Execution Notes

- Web server runs on port 3001 through Playwright webServer.
- Tests run against the in-memory repository mode.
- Dashboard rows are seeded through the shared JSON store at `tests/e2e/dashboard/.tmp/dashboard-usage-store.json`.

## Latest Execution

- Status: Passed
- Command: `npx playwright test tests/e2e/dashboard`
- Date: 2026-05-08
- Result: 2 tests passed in headless Chromium using the in-memory dashboard store.
- Notes: Next dev emitted an `allowedDevOrigins` warning for `127.0.0.1` asset requests during Playwright execution, but it did not block the suite.