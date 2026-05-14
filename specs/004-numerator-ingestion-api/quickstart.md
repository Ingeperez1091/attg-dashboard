# Quickstart: Numerator Data Ingestion API

## Goal

Implement and verify the MVP `POST /api/numerator` endpoint that stages raw numerator JSON in Azure SQL with audit metadata and repo-aligned authorization.

## Prerequisites

- Repository is on branch `004-numerator-ingestion-api`.
- SQL-backed local environment is available when running integration checks against the real staging table.
- The existing session helper can provide an authenticated user through `DEV_SESSION_USER_ID` or request headers.

## Implementation Steps

1. Add the endpoint route under `src/frontend/app/api/numerator/route.ts`.
2. Keep `route.ts` as a transport adapter only: parse request, call application service, map responses.
3. Add request schema validation in `src/frontend/lib/validation/numeratorIngestionSchema.ts`.
4. Add ingestion orchestration service in `src/frontend/core/application/services/numeratorIngestionService.ts`.
5. Add repository contract in `src/frontend/core/domain/repositories/numeratorIngestionRepository.ts`.
6. Add SQL repository in `src/frontend/infrastructure/persistence/database/sqlNumeratorIngestionRepository.ts` and optional in-memory repository in `src/frontend/infrastructure/persistence/memory/inMemoryNumeratorIngestionRepository.ts`.
7. Add runtime wiring in `src/frontend/infrastructure/persistence/runtime/numeratorIngestionRepositoryFactory.ts`.
8. Reuse the existing session and error-response patterns to keep API behavior consistent.
9. Add contract tests under `tests/contract/numerator-ingestion/`.
10. Add integration tests under `tests/integration/numerator-ingestion/` that verify staged rows and audit metadata.

## Suggested Validation Flow

1. Authenticate request.
2. Validate JSON body structure.
3. Confirm the application exists and is active.
4. Confirm the caller is allowed to submit for that application.
5. Serialize and persist the raw payload to `stage.EngagementUsageRaw`.
6. Return `201` with a staged-ingestion acknowledgment.

## Local Verification

From the repository root or `src/frontend` as appropriate:

```powershell
npm run typecheck
npm test
```

If contract and integration tests are split by path in the current test runner, run the numerator-ingestion suites directly once they exist.

Targeted numerator suite command:

```powershell
npx vitest run tests/contract/numerator-ingestion tests/integration/numerator-ingestion
```

## Validation Outcomes

- `npm run type-check` passed after endpoint, service, and sanitization guard updates.
- `npm test -- --silent` passed with `27` test files and `49` tests green.
- Sanitization regression was validated with:

```powershell
npm test -- tests/contract/numerator-ingestion/post-numerator-sanitization.contract.test.ts
```

- Prototype-pollution style payloads are now rejected as `400 VALIDATION_ERROR`.

## DEV_SESSION_USER_ID Test Plan

Use `DEV_SESSION_USER_ID` differently by test type to preserve deterministic test behavior and meaningful authorization coverage.

### 1. Unit Tests

- Default: do not rely on `DEV_SESSION_USER_ID`.
- Model session context explicitly in test doubles/mocks so each role path is deterministic.
- Validate role outcomes directly (administrator allowed, application_owner scoped, viewer denied) without any environment-dependent fallback.

### 2. Integration Tests

- Default: keep `DEV_SESSION_USER_ID` unset.
- Drive authenticated/unauthenticated/forbidden scenarios via request/session fixtures, not via global dev override.
- Add one explicit integration case that sets `DEV_SESSION_USER_ID` to confirm dev-session wiring works as expected, but keep this separate from authorization contract assertions.

Example PowerShell pattern:

```powershell
# normal integration run (no dev override)
Remove-Item Env:DEV_SESSION_USER_ID -ErrorAction SilentlyContinue
npx vitest run tests/integration/numerator-ingestion

# optional dev-session integration check
$env:DEV_SESSION_USER_ID = "10000000-0000-0000-0000-000000000001"
npx vitest run tests/integration/numerator-ingestion --testNamePattern "dev session"
Remove-Item Env:DEV_SESSION_USER_ID -ErrorAction SilentlyContinue
```

### 3. Local Manual Testing

- For fast local happy-path checks, set `DEV_SESSION_USER_ID` to a seeded admin or application_owner user.
- For security checks (401/403), unset `DEV_SESSION_USER_ID` and test with real/explicit auth contexts.
- Do not treat pass results with `DEV_SESSION_USER_ID` set as proof of authorization correctness.

Example PowerShell pattern:

```powershell
# quick local test as seeded user
$env:DEV_SESSION_USER_ID = "10000000-0000-0000-0000-000000000001"
npm run dev

# security validation mode
Remove-Item Env:DEV_SESSION_USER_ID -ErrorAction SilentlyContinue
npm run dev
```

### 4. CI Guardrail

- CI test jobs must run with `DEV_SESSION_USER_ID` unset.
- If a test requires this variable, the test name and intent should state it clearly (dev-session behavior only).

## Manual API Check

Example request shape:

```json
{
  "applicationId": "10000000-0000-0000-0000-000000000001",
  "payload": [
    {
      "engagementId": "E-12345",
      "region": "US"
    }
  ]
}
```

Expected success outcome:

- HTTP `201`
- Response body contains `ingestionId`, `applicationId`, `submittedAt`, and `status: "staged"`
- A corresponding row exists in `stage.EngagementUsageRaw`

## Out of Scope Reminder

- Denominator validation
- Duplicate detection
- Numerator filtering
- Metric recalculation
- Spreadsheet upload parsing

These belong to downstream pipeline features, not the request path in Epic 003.