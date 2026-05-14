# Tasks: EPIC-BQM-005 Authentication and Authorization

**Input**: Design documents from `/specs/011-authentication-authorization/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/authz-contract.md, quickstart.md

**Tests**: Tests are required for this feature by the constitution, quickstart, and plan. Write test tasks first within each user story phase.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish shared test scaffolding and local configuration references for authentication and authorization work.

- [X] T001 Create shared contract auth helpers in tests/contract/authentication-authorization/auth-test-helpers.ts
- [X] T002 Create shared integration auth helpers in tests/integration/authentication-authorization/auth-test-helpers.ts
- [X] T003 [P] Document authentication environment variables in src/frontend/.env.local and README.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the shared auth/session/authorization infrastructure that all user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 Harden shared session resolution and active-user enforcement in src/frontend/lib/auth/session.ts and src/frontend/lib/auth/guards.ts
- [X] T005 [P] Centralize shared role and application-scope assertions in src/frontend/lib/auth/authorization.ts, src/frontend/lib/auth/dashboardScope.ts, and src/frontend/lib/auth/pipelineAuthorization.ts
- [X] T006 [P] Align shared API authorization wrappers in src/frontend/app/api/admin/users/middleware.ts and src/frontend/infrastructure/middleware/filterAuthorizationMiddleware.ts
- [X] T007 [P] Normalize admin route access evaluation in src/frontend/lib/auth/admin-access.ts and src/frontend/core/application/services/AuthService.ts

**Checkpoint**: Shared security primitives, wrappers, and access evaluators are ready for story implementation.

---

## Phase 3: User Story 1 - Enforce Authenticated Access (Priority: P1) 🎯 MVP

**Goal**: Require authenticated access for protected dashboard pages and APIs so anonymous callers are blocked consistently.

**Independent Test**: Request protected pages and APIs with and without an authenticated session and verify valid sessions succeed while unauthenticated requests receive redirects or `401` responses.

### Tests for User Story 1 ⚠️

- [X] T008 [P] [US1] Add contract coverage for unauthenticated protected API access in tests/contract/authentication-authorization/protected-api-authentication.contract.test.ts
- [X] T009 [P] [US1] Add integration coverage for protected page and session access in tests/integration/authentication-authorization/session-route-protection.integration.test.ts

### Implementation for User Story 1

- [X] T010 [US1] Enforce authenticated access on pipeline and metrics endpoints in src/frontend/app/api/pipeline/run/route.ts, src/frontend/app/api/pipeline/[runId]/route.ts, and src/frontend/app/api/metrics/[appId]/route.ts
- [X] T011 [US1] Enforce authenticated access on application model and filter read endpoints in src/frontend/app/api/applications/[appId]/numeratormodel/route.ts, src/frontend/app/api/filters/numerator/[appId]/route.ts, and src/frontend/app/api/filters/denominator/[appId]/route.ts
- [X] T012 [US1] Protect the admin users page entrypoint for unauthenticated callers in src/frontend/app/admin/users/page.tsx and src/frontend/lib/auth/admin-access.ts
- [X] T013 [US1] Standardize unauthenticated response mapping for protected flows in src/frontend/lib/api/error-handler.ts, src/frontend/app/api/pipeline/run/route.ts, and src/frontend/app/api/metrics/[appId]/route.ts

**Checkpoint**: User Story 1 is complete when anonymous access is blocked consistently across protected routes and APIs.

---

## Phase 4: User Story 2 - Enforce Role-Based Route and Action Protection (Priority: P1)

**Goal**: Restrict admin and write actions to the appropriate roles while preserving administrator access to all protected capabilities.

**Independent Test**: Exercise admin routes and protected write actions as `administrator`, `application_owner`, and `viewer` and verify the role matrix matches the contract.

### Tests for User Story 2 ⚠️

- [X] T014 [P] [US2] Add contract coverage for admin-only and role-based action protection in tests/contract/authentication-authorization/role-route-authorization.contract.test.ts
- [X] T015 [P] [US2] Add integration coverage for admin route protection and filter write behavior in tests/integration/authentication-authorization/role-route-authorization.integration.test.ts
- [X] T016 [P] [US2] Add contract coverage for exactly-one-active-role enforcement on role updates in tests/contract/authentication-authorization/single-role-enforcement.contract.test.ts

### Implementation for User Story 2

- [X] T017 [US2] Enforce exactly-one-active-role assignment semantics in src/frontend/app/api/admin/users/[userId]/role/route.ts and src/frontend/core/application/services/AuthService.ts
- [X] T018 [US2] Enforce administrator-only behavior across admin user APIs in src/frontend/app/api/admin/users/route.ts, src/frontend/app/api/admin/users/[userId]/route.ts, src/frontend/app/api/admin/users/[userId]/role/route.ts, src/frontend/app/api/admin/users/[userId]/applications/route.ts, and src/frontend/app/api/admin/users/[userId]/applications/[applicationId]/route.ts
- [X] T019 [US2] Enforce role-based filter write permissions in src/frontend/infrastructure/middleware/filterAuthorizationMiddleware.ts and src/frontend/app/api/filters/denominator/[appId]/preview/route.ts
- [X] T020 [US2] Enforce role-aware admin route redirect and forbidden behavior in src/frontend/lib/auth/admin-access.ts, src/frontend/app/admin/users/page.tsx, and src/frontend/app/admin/users/components/users-page-client.tsx
- [X] T021 [US2] Remove internal detail leakage from forbidden responses in src/frontend/app/api/admin/users/middleware.ts and src/frontend/lib/api/error-handler.ts

**Checkpoint**: User Story 2 is complete when role-based route and action permissions match the contract across admin and filter-edit surfaces.

---

## Phase 5: User Story 3 - Enforce Application-Scoped Data Visibility (Priority: P1)

**Goal**: Ensure non-admin users can only read or act on data for applications explicitly assigned to them.

**Independent Test**: Assign a user to a subset of applications and verify dashboard, metrics, filters, and pipeline endpoints exclude or reject access to unassigned applications.

### Tests for User Story 3 ⚠️

- [X] T022 [P] [US3] Add contract coverage for assigned vs unassigned application visibility in tests/contract/authentication-authorization/application-scope-visibility.contract.test.ts
- [X] T023 [P] [US3] Add integration coverage for application-scoped dashboard and API visibility in tests/integration/authentication-authorization/application-scope-visibility.integration.test.ts

### Implementation for User Story 3

- [X] T024 [US3] Enforce application scope for metrics and dashboard usage reads in src/frontend/lib/auth/dashboardScope.ts, src/frontend/app/api/metrics/[appId]/route.ts, src/frontend/app/api/dashboard/usage/route.ts, and src/frontend/app/api/dashboard/usage/state/route.ts
- [X] T025 [US3] Enforce application scope for pipeline trigger, status, and validation visibility in src/frontend/lib/auth/pipelineAuthorization.ts, src/frontend/app/api/pipeline/run/route.ts, src/frontend/app/api/pipeline/[runId]/route.ts, src/frontend/app/api/pipeline/validation-results/[appId]/route.ts, and src/frontend/app/api/pipeline/validation-results/[appId]/summary/route.ts
- [X] T026 [US3] Enforce application scope for filter and application-model read surfaces in src/frontend/infrastructure/middleware/filterAuthorizationMiddleware.ts, src/frontend/app/api/applications/[appId]/numeratormodel/route.ts, src/frontend/app/api/filters/denominator/[appId]/settings/route.ts, and src/frontend/app/api/filters/denominator/[appId]/audit/route.ts
- [X] T027 [US3] Make role and application assignment changes effective on subsequent authorization checks in src/frontend/lib/auth/session.ts and src/frontend/core/application/services/AuthService.ts

**Checkpoint**: User Story 3 is complete when non-admin users only see and act within assigned application scope.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finish documentation, regression hardening, and end-to-end validation across all user stories.

- [X] T028 [P] Add contract and integration coverage for identity-linked auditability on governed admin and filter operations in tests/contract/authentication-authorization/audit-identity.contract.test.ts and tests/integration/authentication-authorization/audit-identity.integration.test.ts
- [X] T029 Implement authenticated identity propagation for governed operation audit fields in src/frontend/lib/auth/session.ts, src/frontend/lib/auth/authorization.ts, src/frontend/app/api/admin/users/middleware.ts, and src/frontend/infrastructure/middleware/filterAuthorizationMiddleware.ts
- [X] T030 [P] Update feature runbook and implementation notes in specs/011-authentication-authorization/quickstart.md and README.md
- [X] T031 Add regression coverage for seeded super-admin and non-production DEV fallback behavior in tests/integration/authentication-authorization/dev-session-fallback.integration.test.ts
- [X] T032 [P] Add non-security parity regression coverage for authorized requests on metrics, numerator model, numerator filters, and denominator filters endpoints in tests/contract/authentication-authorization/non-security-parity.contract.test.ts and tests/integration/authentication-authorization/non-security-parity.integration.test.ts
- [X] T033 Add regression coverage for stable generic non-security failure semantics (for example, "Failed to load data") on authorized requests with downstream dependency failures in tests/integration/authentication-authorization/non-security-error-stability.integration.test.ts
- [X] T034 Run full auth/authz and non-security regression validation commands and record any quickstart corrections in specs/011-authentication-authorization/quickstart.md

---

## Phase 7: Azure AD SSO Integration

**Purpose**: Wire Auth.js v5 (`next-auth@beta`) with the Microsoft Entra ID provider as the production login flow, mapping Azure AD OID to internal session principals and protecting routes with Next.js edge middleware.

**⚠️ PREREQUISITE**: Phase 2 foundational session infrastructure (T004) must be complete. This phase extends `session.ts` with Auth.js as the primary session source without breaking existing guards, role checks, or downstream tests.

### Tests for Phase 7 ⚠️

- [X] T035 [P] Add contract coverage for Auth.js v5 JWT-to-internal-session-principal bridge in `getOptionalSession` (mocked `auth()` returns AAD OID → user lookup resolves internal principal) in tests/contract/authentication-authorization/sso-session-mapping.contract.test.ts
- [X] T036 [P] Add integration coverage for `findByAzureAdObjectId` repository lookup and AAD OID-to-userId resolution in the in-memory repository in tests/integration/authentication-authorization/sso-user-lookup.integration.test.ts

### Implementation for Phase 7

- [X] T037 Extend `IUserRepository` interface, `UserMemoryRepository`, and `UserDbRepository` with `findByAzureAdObjectId(oid: string): Promise<User | null>` and first-login `bindAzureAdObjectId(userId, oid)` support so Azure AD identity can be auto-linked to the internal user on first successful SSO sign-in in src/frontend/core/domain/repositories/IUserRepository.ts, src/frontend/infrastructure/persistence/memory/UserMemoryRepository.ts, and src/frontend/infrastructure/persistence/database/UserDbRepository.ts
- [X] T038 Install `next-auth@beta` and document required Azure AD/Microsoft Entra ID environment variables (`AUTH_SECRET`, `AUTH_MICROSOFT_ENTRA_ID_ID`, `AUTH_MICROSOFT_ENTRA_ID_SECRET`, `AUTH_MICROSOFT_ENTRA_ID_TENANT_ID`) in package.json and src/frontend/.env.local; replace the placeholder `NEXTAUTH_*` vars with the Auth.js v5 equivalents
- [X] T039 Create Auth.js v5 configuration with `MicrosoftEntraId` provider, JWT callback to persist AAD `oid` claim, and `/login` sign-in page override in src/frontend/auth.ts
- [X] T040 [P] Create Auth.js route handler to export the `handlers` GET and POST from `src/frontend/auth.ts` in src/frontend/app/api/auth/[...nextauth]/route.ts
- [X] T041 Create the login page with a Microsoft Entra ID sign-in button, `returnUrl` query-param support for post-sign-in redirect, and accessible loading state in src/frontend/app/login/page.tsx; remove Azure AD Object ID entry from admin user create/edit UI and API payload validation so it is not required on create and cannot be manually edited
- [X] T042 Update session resolution in src/frontend/lib/auth/session.ts to call `auth(request)` from Auth.js as the primary session source, resolve the AAD `oid` claim to an internal session principal via `findByAzureAdObjectId`, auto-fill `azureAdObjectId` on the first successful login when missing (system audit/logged), and retain the existing Bearer token header fallback (for API clients and Postman) and the non-production `DEV_SESSION_USER_ID` fallback
- [X] T043 Create Next.js App Router edge middleware to redirect unauthenticated requests on protected routes to `/login` with a `returnUrl` parameter in src/frontend/middleware.ts; exclude `/login`, `/api/auth/**`, and static assets from the protected matcher

### Polish for Phase 7

- [X] T044 [P] Update the SSO setup guide with Azure AD app registration steps, required environment variables, callback URL configuration, and SSO validation commands in specs/011-authentication-authorization/quickstart.md and README.md

**Checkpoint**: Phase 7 is complete when a browser visit to a protected route redirects to the Microsoft Entra ID login page, successful sign-in resolves to an internal session with correct role and application scope, and all existing auth/authz tests remain green.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup**: No dependencies; can start immediately.
- **Phase 2: Foundational**: Depends on Phase 1 completion; blocks all user stories.
- **Phase 3-5: User Stories**: Depend on Phase 2 completion; then proceed in priority order or in parallel if staffed.
- **Phase 6: Polish**: Depends on completion of user stories and is required before feature completion/release.
- **Phase 7: Azure AD SSO Integration**: Depends on Phase 2 foundational session infrastructure (T004). Can run in parallel with Phase 6 if staffed separately. T037 (repository interface) must complete before T042 (session.ts update) and before tests T035/T036 compile. T038 (install package) must complete before T039 (auth.ts) and T040 (route handler). T039 must complete before T041, T042, and T043.

### User Story Dependencies

- **US1**: Starts after Foundational; no dependency on later stories.
- **US2**: Starts after Foundational; builds on shared auth primitives but remains independently testable.
- **US3**: Starts after Foundational; may reuse US1/US2 primitives but remains independently testable.

### Within Each User Story

- Write tests first and confirm they fail before implementation.
- Shared auth/session abstractions before route-specific updates.
- Route and UI protections before regression/polish checks.

### Parallel Opportunities

- `T003` can run in parallel with `T001-T002`.
- `T005-T007` can run in parallel after `T004` starts stabilizing shared auth primitives.
- Within each user story, test tasks marked `[P]` can run in parallel.
- `T024-T026` can proceed in parallel once shared scope assertions are stable.
- `T035` and `T036` (Phase 7 tests) can be written in parallel once `T037` repository additions compile.
- `T039` and `T040` can be written in parallel once `T038` package install is complete.
- `T041`, `T042`, and `T043` can proceed in parallel once `T039` auth.ts skeleton is stable.
- `T044` can run in parallel with `T041-T043`.

---

## Parallel Example: User Story 3

```bash
# Contract and integration scope tests together
Task: "Add contract coverage for assigned vs unassigned application visibility in tests/contract/authentication-authorization/application-scope-visibility.contract.test.ts"
Task: "Add integration coverage for application-scoped dashboard and API visibility in tests/integration/authentication-authorization/application-scope-visibility.integration.test.ts"

# Endpoint families once shared scope helpers are ready
Task: "Enforce application scope for metrics and dashboard usage reads in src/frontend/lib/auth/dashboardScope.ts, src/frontend/app/api/metrics/[appId]/route.ts, src/frontend/app/api/dashboard/usage/route.ts, and src/frontend/app/api/dashboard/usage/state/route.ts"
Task: "Enforce application scope for pipeline trigger, status, and validation visibility in src/frontend/lib/auth/pipelineAuthorization.ts, src/frontend/app/api/pipeline/run/route.ts, src/frontend/app/api/pipeline/[runId]/route.ts, src/frontend/app/api/pipeline/validation-results/[appId]/route.ts, and src/frontend/app/api/pipeline/validation-results/[appId]/summary/route.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Validate protected-route and protected-API unauthenticated behavior.

### Incremental Delivery

1. Setup + Foundational provide shared security infrastructure.
2. Deliver US1 for authenticated access enforcement.
3. Add US2 for role-based route and action protection.
4. Add US3 for application-scoped data visibility.
5. Finish with regression hardening and documentation updates.

### Parallel Team Strategy

1. One developer stabilizes shared session and guard infrastructure.
2. One developer focuses on admin and role-protected route/API behavior.
3. One developer focuses on app-scoped data endpoints and visibility checks.

---

## Notes

- All tasks follow the required checklist format with exact file paths.
- Story phases are independently testable and aligned to the spec priorities.
- Tests are included because the feature specification, plan, and constitution explicitly require them.