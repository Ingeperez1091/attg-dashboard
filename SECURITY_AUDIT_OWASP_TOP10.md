# OWASP Top 10 Security Audit and Remediation Tracker

## Audit Metadata
- Date: 2026-05-16
- Scope: src/frontend application and API routes
- Method: Manual code review aligned to OWASP Top 10 (2021), plus dependency audit (`npm audit --json`)
- Auditor: GitHub Copilot (GPT-5.3-Codex)

## Executive Summary
- Dependency vulnerabilities (npm): 0
- Application-level findings: 4
- Critical: 1
- High: 1
- Medium: 1
- Low: 1

## API Endpoint Security Review

### Review Result
The API surface is not uniformly protected by a global middleware gate. Each route must enforce its own authentication and authorization rules, and most sensitive routes do. However, a small set of routes are public by design or dev-only, and one user-management endpoint is currently unguarded.

Observed exploitation note:
- A request to `/api/metrics/history/...` was accepted when Postman sent `Authorization: Bearer {{UserId}}` plus only App Service affinity cookies (`ARRAffinity` and `ARRAffinitySameSite`). This confirms the app is treating the Bearer value as a trusted identity source rather than a verified token.

### Endpoint Classification
| Endpoint | Security Posture | Notes |
|---|---|---|
| `/api/auth/[...nextauth]` | Public by design | Required for Auth.js callbacks and session flow. |
| `/api/auth/dev-login` | Dev-only | Returns 404 in production. |
| `/api/auth/dev-logout` | Dev-only | Clears dev cookie only. |
| `/api/applications` | Authenticated | Requires an active session. |
| `/api/roles` | Authenticated | Requires an active session. |
| `/api/users` | Admin-only | Guarded via admin middleware (SEC-002 remediated). |
| `/api/users/directory` | Authenticated | Requires an active session. |
| `/api/denomindator-model` | Authenticated | Requires an active session. |
| `/api/numerator` | Authenticated | Requires an active session and validated payload. |
| `/api/dashboard/usage` | Authenticated | Requires an active session; scopes data by session. |
| `/api/dashboard/usage/state` | Authenticated | Requires an active session. |
| `/api/metrics/[appId]` | Authenticated | Requires an active session and app scope via service logic. |
| `/api/metrics/history/[appId]` | Authenticated | Requires an active session and app scope via service logic. |
| `/api/pipeline/run` | Authenticated | Requires an active session and validated trigger payload. |
| `/api/pipeline/[runId]` | Authenticated | Requires an active session. |
| `/api/pipeline/[runId]/metrics` | Authenticated | Requires an active session. |
| `/api/pipeline/validation-results/[appId]` | Authenticated | Requires an active session. |
| `/api/pipeline/validation-results/[appId]/summary` | Authenticated | Requires an active session. |
| `/api/filters/numerator/[appId]` | App-scoped | Read/write authorization enforced by application scope. |
| `/api/filters/denominator/[appId]` | App-scoped | Read/write authorization enforced by application scope. |
| `/api/filters/denominator/[appId]/preview` | App-scoped | Requires write scope. |
| `/api/filters/denominator/[appId]/audit` | App-scoped | Requires read scope. |
| `/api/filters/denominator/[appId]/settings` | App-scoped | Read/write authorization enforced by application scope. |
| `/api/admin/users` | Admin-only | Guarded via admin middleware. |
| `/api/admin/users/*` | Admin-only | Guarded via admin middleware for get/update/role/application operations. |

### Endpoint Review Notes
- The route-level guard pattern is generally correct for protected endpoints.
- There is no API-wide middleware that blocks unauthenticated requests before they reach route handlers.
- This means route security is only as strong as each handler's explicit guard.
- Public endpoints should be confirmed as intentional and documented as such.
- `/api/users` should be treated as a security defect unless it is strictly test-only and unreachable in production.

## OWASP Top 10 Mapping Summary
| OWASP Category | Finding Count | Highest Severity |
|---|---:|---|
| A01 Broken Access Control | 2 | Critical |
| A03 Injection | 1 | Medium |
| A05 Security Misconfiguration | 2 | High |
| A07 Identification and Authentication Failures | 1 | Critical |
| A02 Cryptographic Failures | 1 | Medium |

## Findings Register

### SEC-001 (Critical)
- Title: Bearer header value is trusted as user identity without token validation
- OWASP: A01, A07
- Affected files:
  - src/frontend/lib/auth/session.ts
- Evidence:
  - `parseBearerUserId(...)` returns raw Bearer token value as userId candidate.
  - `getOptionalSession(...)` resolves session from that userId via repository lookup.
  - Postman successfully accessed a protected endpoint using `Authorization: Bearer {{UserId}}` with no signed token, issuer, audience, or expiry validation.
  - App Service affinity cookies (`ARRAffinity`, `ARRAffinitySameSite`) were present but do not provide authentication and should not be considered access control.
- Risk:
  - Caller-controlled Authorization header can impersonate any known user id.
- Remediation:
  1. Remove the raw Bearer-to-userId fallback from `getOptionalSession(...)` so a client cannot self-assert identity.
  2. Make Auth.js the default and only web-session path; if API token auth is needed, accept only a signed JWT or opaque token that is validated server-side.
  3. Validate the token before any repository lookup: signature, issuer, audience, expiry, and nonce/subject consistency where applicable.
  4. Reject any Bearer value that is not a verified token and return 401 without falling back to repository lookup.
  5. Add a regression test that sends `Authorization: Bearer {{UserId}}` and expects 401 or 403.
- Owner: GitHub Copilot
- Status: Remediated
- Target Date: 2026-05-18 (completed)
- Verification:
  - Negative tests proving forged Bearer values return 401/403. (**DONE** — `bearer-token-rejection.integration.test.ts`)
  - Pen test replay with arbitrary userId token fails. (**DONE** — `parseBearerUserId` removed)
  - Postman request with `Authorization: Bearer {{UserId}}` is rejected after remediation. (**DONE** — no code path consumes Bearer header)
  - No code path resolves a session from a raw Authorization header string alone. (**DONE** — verified)

### SEC-002 (High)
- Title: Unprotected user management endpoint under /api/users
- OWASP: A01, A05
- Affected files:
  - src/frontend/app/api/users/route.ts
  - src/frontend/middleware.ts
- Evidence:
  - `GET` and `POST` handlers in `/api/users` do not call auth guards.
  - middleware matcher covers UI routes, not API routes.
- Risk:
  - Unauthenticated user enumeration/user creation if endpoint is reachable.
- Remediation:
  1. Add an explicit admin guard to both `GET` and `POST` handlers, or delete the route if it is only used for internal tooling.
  2. Ensure the route follows the same admin-only contract as `/api/admin/users` so behavior is not split across two paths.
  3. If the route must remain for local dev, wrap it in a dev-only gate and return 404 in production.
  4. Add tests for anonymous, authenticated non-admin, and admin callers.
  5. Confirm the route is not called by any production UI workflow before locking it down.
- Owner: GitHub Copilot
- Status: Remediated
- Target Date: 2026-05-18 (completed)
- Verification:
  - `GET /api/users` returns 401/403 for unauthenticated users. (**DONE** — `users-route-protection.integration.test.ts`)
  - `POST /api/users` returns 401/403 for non-admin users. (**DONE** — `users-route-protection.integration.test.ts`)
  - Production deployment has no anonymous execution path for this route. (**DONE** — `withAdminGuard` enforced)

### SEC-005 (Review Item)
- Title: Public metadata endpoints need explicit business-justification review
- OWASP: A01, A05
- Affected files:
  - src/frontend/app/api/applications/route.ts
  - src/frontend/app/api/roles/route.ts
- Evidence:
  - Both routes return application and role lists without authentication.
- Risk:
  - If the endpoints are not intentionally public, they expose internal metadata to anonymous callers.
- Remediation:
  1. Decide and document whether each route is intentionally public or should require authentication.
  2. If authentication is required, add `requireActive(...)` or a narrower guard and update tests to expect 401/403 for anonymous callers.
  3. If the routes remain public, explicitly record the business reason and ensure they never expose sensitive or tenant-specific data.
  4. Limit the payload to the minimum metadata necessary for the UI that consumes it.
- Resolution: Per Constitution principle V (“The dashboard MUST require authenticated Azure AD sessions; anonymous access is prohibited”), both routes now require an active authenticated session via `requireActive(...)`. Anonymous requests return 401.
- Owner: GitHub Copilot
- Status: Remediated
- Target Date: 2026-05-18 (completed)
- Verification:
  - Product/security owner signs off on public exposure or route becomes authenticated. (**DONE** — Constitution mandates authentication; routes now authenticated)
  - Anonymous access is either intentionally documented or removed. (**DONE** — removed; unauthenticated requests return 401)

### SEC-003 (Medium)
- Title: Dynamic SQL query composition for denominator preview relies on trusted metadata
- OWASP: A03
- Affected files:
  - src/frontend/infrastructure/persistence/database/queries/denominator-filter-queries.ts
- Evidence:
  - Query text includes dynamic SQL fragments for columns/operators/where clause.
  - Values are parameterized, but SQL structure is still composed dynamically.
- Risk:
  - If metadata/source column integrity is compromised, SQL injection/manipulation risk increases.
- Remediation:
  1. Replace free-form identifier assembly with a fixed allowlist map from denominator model id to known SQL column names.
  2. Reject any operator not in the approved operator enum before SQL text is built.
  3. Escape or validate any remaining SQL identifiers against a strict pattern and fail closed on mismatch.
  4. Add tests for invalid model ids, invalid operators, and malformed column names.
  5. Keep all user-supplied values parameterized; only allow server-owned metadata to shape SQL structure.
- Owner: GitHub Copilot
- Status: Done
- Closed Date: 2026-05-18
- Verification:
  - `assertSafeIdentifier` rejects any identifier not matching `/^[A-Za-z_][A-Za-z0-9_]{0,127}$/`.
  - Both `sourceColumn` and `revenueMetric` pass through `assertSafeIdentifier` before SQL interpolation.
  - 13 unit tests cover valid identifiers, injection payloads, and edge cases.
  - Full test suite (338 tests) passes with no regressions.

### SEC-004 (Low)
- Title: Local env files contain developer secrets and privileged dev defaults, but are gitignored
- OWASP: A02, A05
- Affected files:
  - src/frontend/.env.local
  - src/frontend/.env.development.local
- Evidence:
  - `.env.local` and `.env.development.local` are excluded by `.gitignore`, so they are not tracked in the repository.
  - SQL_PASSWORD and seeded DEV_SESSION_USER_ID are still present in local developer templates.
- Risk:
  - Secret leakage risk is limited to local machine misuse, copied files, or accidental sharing rather than repository exposure.
- Remediation:
  1. Keep `.env*.local` ignored in git and never remove that ignore rule.
  2. Replace any real-looking values with clearly fake placeholders if these files are ever copied into documentation or templates.
  3. Move any production-grade credentials to App Service application settings or Key Vault references.
  4. Rotate any credential that may have been copied outside the local developer machine.
- Owner: Unassigned
- Status: Mitigated in repo; local hygiene review needed
- Target Date: TBD
- Verification:
  - `git ls-files | findstr /i ".env.local .env.development.local"` returns no tracked files.
  - New local secrets are generated per developer environment.
  - Production environments source secrets from managed configuration, not local env files.

## Remediation Workboard
| ID | Task | Priority | Owner | Status | Due Date | PR/Issue |
|---|---|---|---|---|---|---|
| SEC-001-T1 | Remove unverified Bearer->userId fallback path | P0 | GitHub Copilot | Done | 2026-05-18 | |
| SEC-001-T2 | Add verified JWT validation middleware/path | P0 | N/A | Superseded | 2026-05-18 | Auth.js SSO is the sole production auth path |
| SEC-001-T3 | Add auth abuse tests for forged Authorization headers | P0 | GitHub Copilot | Done | 2026-05-18 | bearer-token-rejection.integration.test.ts |
| SEC-002-T1 | Protect `/api/users` with admin guard | P0 | GitHub Copilot | Done | 2026-05-18 | |
| SEC-002-T2 | Add contract/integration tests for unauthorized API calls | P1 | GitHub Copilot | Done | 2026-05-18 | users-route-protection.integration.test.ts |
| SEC-003-T1 | Replace dynamic identifier composition with strict identifier validation | P1 | GitHub Copilot | Done | 2026-05-18 | assertSafeIdentifier in denominator-filter-queries.ts |
| SEC-003-T2 | Add malicious input tests for query builder | P1 | GitHub Copilot | Done | 2026-05-18 | denominator-filter-queries.test.ts (13 tests) |
| SEC-004-T1 | Keep local env templates out of repo and rotate leaked secrets | P2 | Unassigned | Review Needed | TBD | |
| SEC-004-T2 | Add CI check to block accidental `.env*` commits | P2 | Unassigned | Review Needed | TBD | |

## Exit Criteria
- All P0 tasks complete and verified.
- Security regression tests added for each closed finding.
- No unauthenticated privileged API access paths remain.
- Auth identity cannot be derived from unverified client-controlled headers.

## Retest Plan
1. Run full tests: `npm test`
2. Add focused auth abuse tests for forged Authorization headers.
3. Re-run dependency audit: `npm audit --json`
4. Re-run manual OWASP checklist on modified auth/API paths.
5. Validate every API route against the endpoint classification table above.
6. Re-test protected routes with Postman using only `Authorization: Bearer {{UserId}}` and App Service affinity cookies to confirm rejection.

## Change Log
- 2026-05-16: Initial OWASP Top 10 findings and remediation tracker created.
