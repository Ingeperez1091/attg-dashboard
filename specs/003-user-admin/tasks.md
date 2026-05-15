---
description: "Task list for User Administration & RBAC (EPIC-BQM-002)"
---

# Tasks: User Administration & Role-Based Access Control (EPIC-BQM-002)

**Input**: Design documents from `specs/003-user-admin/`  
**Feature Branch**: `003-user-admin`  
**Prerequisites**: Epic-001 (Database Foundation) merged; Epic-010 (CI Pipeline) active  
**Organization**: Tasks grouped by user story (P1 stories first, then P2), enabling parallel implementation

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label (e.g., US1, US2, US3, US4, US5)
- **Include exact file paths** in every task description

---

## ⚠️ MVP Authentication Strategy (Important!)

**Develop Mode** (Local iteration):
- Authentication is **optional**. If no `Authorization` header is provided, `getSessionUser()` defaults to seeded super-admin user (from Epic-001) via `DEV_SESSION_USER_ID` environment variable.
- **Why**: Enables rapid local development without mocking auth headers on every request. Set `DEV_SESSION_USER_ID` to any active admin user from database.
- **Example**: `curl http://localhost:3000/api/admin/users` works without auth header in develop mode (uses seeded admin).

**Test Mode** (Contract & Integration Tests):
- Session context is injected via Vitest fixtures in `tests/contract/` and `tests/integration/` directories.
- No external authentication provider required per Constitution Principle IV (Test-First with Deterministic Isolation).
- Tests may simulate different roles by injecting different fixture session contexts.

**Extended-MVP** (Future Azure AD SSO):
- Replace `getSessionUser()` in `src/frontend/lib/auth/session.ts` with NextAuth/Azure AD logic.
- **No API or UI changes required** — single-file swap, all guards continue to work.

**Key Constraint for Constitution Principle V (Security & RBAC)**:
- Even though develop mode allows optional auth, all authorization guards (`requireAdministrator()`, `requireActive()`) still enforce role/state checks.
- Non-admin users will always be rejected by API guards, even if they provide a valid session.
- Tests verify this enforcement works correctly; they don't skip auth checks.

## ⚠️ Repository Mode Strategy (Important!)

**Unit and contract tests**:
- Default to in-memory repositories using `USE_INMEMORY_REPOSITORY=true` for deterministic isolation.

**Local development**:
- Support both repository modes:
  - in-memory mode (`USE_INMEMORY_REPOSITORY=true`) for fast local iteration,
  - SQL mode (`USE_INMEMORY_REPOSITORY=false`) for schema/seed parity validation.

**Security rule for SQL mode**:
- All SQL repository queries MUST be parameterized (`mssql` bindings).
- No dynamic SQL interpolation from request/session inputs.

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Establish project structure and baseline dependencies

**MVP Authentication Note**: Develop and test modes support optional auth with seeded admin user (from Epic-001 seeds). Update `.env.local` with `DEV_SESSION_USER_ID` to leverage existing super-admin for rapid iteration.

- [x] T001 Create feature directory structure under `src/frontend/app/admin/users/`, `src/frontend/app/api/admin/users/`, `src/frontend/lib/auth/`, `tests/contract/user-administration/`, `tests/integration/user-administration/`

- [x] T002 [P] Create TypeScript configuration for admin routes and components in `tsconfig.json` (ensure strict mode enabled per constitution)

- [x] T003 [P] Setup Zod validation schema templates in `src/frontend/lib/validation/admin-users.schema.ts` for request payload validation (user creation, role assignment, app assignment), and define repository mode environment contract in `src/frontend/lib/config/repository-mode.ts`:
  - Read `USE_INMEMORY_REPOSITORY` with safe default (`true` for tests, configurable for local dev)
  - Export helper `isInMemoryRepositoryEnabled()`
  - Validate environment value and fail fast on invalid config

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure MUST complete before ANY user story implementation

- [x] T004 Create session abstraction layer `src/frontend/lib/auth/session.ts` with `getSessionUser()` helper returning `userId`, `userRole`, and `userApplications`:
  - **Develop mode**: Check for `Authorization` header; if absent, load seeded admin user from database using `DEV_SESSION_USER_ID` env var (from Epic-001 seeds)
  - **Test mode**: Return fixture user from `NODE_ENV=test` context (Vitest setup)
  - **Extended-MVP**: Hook point for NextAuth/Azure AD (single-file swap, no API impact)
  - Export `getSessionUser()` and optional `getOptionalSession()` (for endpoints that allow unauthenticated requests)

- [x] T005 [P] Create RBAC authorization guards in `src/frontend/lib/auth/guards.ts`:
  - `requireAuthenticated()` — verify user exists (in develop mode, may use seeded admin user)
  - `requireAdministrator()` — verify user role is "administrator" (supports seeded admin in develop mode)
  - `requireActive()` — verify user `IsActive = true`
  - Optional `allowOptional()` — permits requests without auth (for public endpoints, e.g., health checks)
  - All guards must integrate with session layer via `getSessionUser()` and return 401 or 403 per contract
  - Guards must work with both optional auth (develop mode) and required auth (test/production)

- [x] T006 [P] Create error handling and response utilities in `src/frontend/lib/api/error-handler.ts`:
  - Structured error responses with code, message, requestId per contract
  - Status code mapping (400, 401, 403, 404, 409, 500)
  - Audit logging for all errors

- [x] T007 [P] Create database access layer / query helpers in `src/frontend/lib/db/users-queries.ts`:
  - `getUserById(userId)` — retrieve single user with role and applications
  - `listUsers()` — retrieve all active users with roles and applications
  - `createUser(payload)` — INSERT into `app.Users` with audit columns
  - `updateUserActive(userId, isActive)` — UPDATE `IsActive` flag
  - All queries MUST use parameterized bindings per Zod validation and constitution Principle I (Data Integrity)
  - No dynamic SQL string interpolation from request/session values
  - `user-repository.ts`, `role-repository.ts`, `user-application-repository.ts` interfaces
  - `index.ts` repository factory that switches between in-memory and SQL implementations based on `USE_INMEMORY_REPOSITORY`
  - Keep API/service layer persistence-agnostic

- [x] T008 [P] Create database access layer for roles in `src/frontend/lib/db/roles-queries.ts`:
  - `getRoleByName(roleName)` — lookup by 'administrator', 'application_owner', 'viewer'
  - `assignRole(userId, roleId)` — MERGE/upsert into `app.UserRoles` (enforces exactly-one per Decision 3)
  - All mutations MUST populate `CreatedBy` and `UpdatedBy` from session user
  - SQL path MUST be parameterized only; no interpolated SQL fragments

- [x] T009 [P] Create database access layer for application assignments in `src/frontend/lib/db/application-assignments-queries.ts`:
  - `getApplicationsByUser(userId)` — retrieve all `app.UserApplications` for user
  - `assignApplication(userId, applicationId)` — INSERT into `app.UserApplications` (with dedup check)
  - `assignAllApplications(userId)` — MERGE with wildcard `ApplicationId = "*"` per Decision 5
  - `unassignApplication(userId, applicationId)` — DELETE single assignment
  - Handle idempotency: duplicate inserts return 409 per contract
  - SQL path MUST use parameterized statements only

- [x] T010 [P] Create Next.js API middleware in `src/frontend/app/api/admin/users/middleware.ts`:
  - Apply `requireAuthenticated()` guard to all admin routes
  - Apply `requireAdministrator()` guard to all admin routes
  - Attach session user context to request for audit logging
  - Catch and log all errors via error-handler
  - Resolve repositories through the factory (in-memory vs SQL)
  - Ensure behavior parity between modes for validation and authorization outcomes
  - Add startup log line indicating active repository mode (no secrets)

**⚠️ CHECKPOINT**: Foundation MUST be complete before any user story implementation begins

---

## Phase 3: User Story 1 - Administrator Creates New Users (Priority: P1)

**Goal**: Deliver user creation API endpoint with validation, persistence, and audit trail

**Independent Test**: Create a user via POST `/api/admin/users` with valid identity fields, verify 201 response, retrieve user, confirm all fields persisted with audit columns populated by session user

### Contract & Integration Tests for US1

- [x] T011 [P] [US1] Write contract test in `tests/contract/user-administration/users-create.test.ts`:
  - Test 201 success case: valid user creation with seeded admin user (via MVP session fixture) returns new UserId and confirmation
  - Test 400 cases: missing email, missing username, invalid email format
  - Test 409 case: duplicate AzureADObjectId
  - Test 401 case: unauthenticated request (when auth required in test mode)
  - Test 403 case: non-administrator request
  - All tests MUST use Vitest with deterministic in-memory fixtures and session context per Principle IV
  - Note: Tests may optionally inject session context directly rather than via HTTP header

- [x] T012 [P] [US1] Write integration test in `tests/integration/user-administration/users-create-flow.test.ts`:
  - Create user with all fields, verify persisted in `app.Users`
  - Verify `CreateDate` and `CreatedBy` match session context
  - Attempt duplicate create, verify 409 and no duplicate
  - Verify soft-delete state does NOT block recreation of deactivated user with new email

### Implementation for US1

- [x] T013 [US1] Implement POST `/api/admin/users` route handler in `src/frontend/app/api/admin/users/route.ts`:
  - Call `requireAdministrator()` guard (supports optional auth with seeded admin in develop mode)
  - Validate request payload: `username`, `email`, `displayName`, `isActive` via Zod
  - Call `createUser()` query with validated fields + session user ID in `CreatedBy`
  - Return 201 with new user ID and audit metadata on success
  - Catch duplicate error (UNIQUE constraint on `AzureADObjectId`) and return 409
  - Catch validation error and return 400 with field details
  - Log all calls via error-handler utilities
  - In develop mode: if no auth header, defaults to `DEV_SESSION_USER_ID` (seeded admin)

- [x] T014 [US1] Implement GET `/api/admin/users` route handler in `src/frontend/app/api/admin/users/route.ts`:
  - Call `listUsers()` query
  - Return 200 with array of users (id, email, displayName, role, applications, isActive, audit columns)
  - Only return active users by default (`isActive = true`)
  - Support optional `?includeInactive=true` query param to include deactivated users for audit

- [x] T015 [US1] Implement GET `/api/admin/users/[userId]` route handler in `src/frontend/app/api/admin/users/[userId]/route.ts`:
  - Call `getUserById(userId)` query
  - Return 200 with single user detail (all fields + role + applications + audit columns)
  - Return 404 if user not found
  - Apply `requireAdministrator()` guard

- [x] T016 [US1] Add email validation and sanitization in `src/frontend/lib/validation/admin-users.schema.ts`:
  - Email must match RFC 5321 format
  - Username max 255 characters, alphanumeric + underscore/hyphen only (no SQL injection)
  - DisplayName max 255 characters, sanitized UTF-8 (XSS protection)
  - All fields trimmed and lowercased where applicable

- [x] T017 [US1] Add audit logging in `src/frontend/lib/api/audit-logger.ts`:
  - Log every user creation with: action (create), userId, email, timestamp, createdBy
  - Log every creation failure with: reason, payload (sanitized), timestamp
  - Errors must NOT log plaintext passwords or session tokens

**Checkpoint**: User Story 1 complete and independently testable — users can be created via API with audit trail

---

## Phase 4: User Story 2 - Administrator Assigns Exactly One Role Per User (Priority: P1)

**Goal**: Deliver role assignment API endpoint with exactly-one-role enforcement

**Independent Test**: Create user (from US1), assign role via PUT `/api/admin/users/{userId}/role`, verify user has exactly one role, attempt dual-role assignment, verify rejection with 400

### Contract & Integration Tests for US2

- [x] T018 [P] [US2] Write contract test in `tests/contract/user-administration/users-role-assign.test.ts`:
  - Test 200 success case: valid role assignment (as seeded admin user) returns updated user with new role
  - Test 400 cases: missing roleId, invalid roleId, empty request body
  - Test 404 case: userId not found
  - Test 401/403 cases: unauthenticated (if auth-required mode), non-administrator
  - All tests validate role values are ONLY: 'administrator', 'application_owner', 'viewer'
  - Tests may use in-memory session fixture to simulate admin context

- [x] T019 [P] [US2] Write integration test in `tests/integration/user-administration/users-role-assign-flow.test.ts`:
  - Create user, assign 'application_owner' role, verify persisted in `app.UserRoles`
  - Retrieve user, verify exactly one `role` field returned
  - Assign new role 'administrator' to same user, verify old role replaced (no dual-role)
  - Verify `UpdateDate` and `UpdatedBy` updated on each assignment

### Implementation for US2

- [x] T020 [US2] Implement PUT `/api/admin/users/{userId}/role` route handler in `src/frontend/app/api/admin/users/[userId]/role/route.ts`:
  - Validate request: `roleId` MUST be one of three enum values (administrator, application_owner, viewer)
  - Call `requireAdministrator()` guard (optional auth with seeded admin in develop mode)
  - Call `getUserById(userId)` to verify user exists (return 404 if not)
  - Call `assignRole(userId, roleId)` query with MERGE semantics (enforces exactly-one per Decision 3)
  - Return 200 with updated user (role + previous role removed automatically by DB constraint)
  - Return 400 if roleId invalid
  - Catch constraint violation and return 409 (should not happen if MERGE works correctly)
  - Note: In develop mode, request may omit Authorization header and use seeded admin user

- [x] T021 [US2] Extend role queries in `src/frontend/lib/db/roles-queries.ts`:
  - Ensure `assignRole()` uses T-SQL MERGE to atomically replace old role with new role
  - MERGE MUST target `app.UserRoles` on `(UserId, RoleId)` join
  - MERGE MUST delete old row before inserting new row if role differs
  - All mutations MUST populate `UpdateDate` and `UpdatedBy`

- [x] T022 [US2] Add role enum validator in `src/frontend/lib/validation/admin-users.schema.ts`:
  - Define enum: ['administrator', 'application_owner', 'viewer']
  - Validate roleId exists in `app.Roles` table (optional: pre-cache roles on startup)
  - Return 400 with available roles on mismatch

**Checkpoint**: User Story 2 complete — users can be assigned exactly one role; role changes are atomic

---

## Phase 5: User Story 3 - Administrator Assigns Users to Applications (Priority: P1)

**Goal**: Deliver application assignment API with per-app scope and "All Applications" shortcut

**Independent Test**: Create user (US1), assign to "Maestro" app via POST `/api/admin/users/{userId}/applications`, verify persisted; assign to "All Applications" via `all=true`, verify wildcard stored; attempt duplicate, verify 409

### Contract & Integration Tests for US3

- [x] T023 [P] [US3] Write contract test in `tests/contract/user-administration/users-applications-assign.test.ts`:
  - Test 201 success case: assign single app (as seeded admin user) returns created relationship
  - Test 201 success case: assign `"all": true` returns wildcard assignment
  - Test 400 cases: missing applicationId, invalid applicationId, both app and `all: true`
  - Test 409 case: duplicate assignment to same app
  - Test 404 case: userId not found
  - Test 401/403 cases: unauthenticated (if required), non-administrator
  - Tests may inject admin session context via fixture

- [x] T024 [P] [US3] Write integration test in `tests/integration/user-administration/users-applications-assign-flow.test.ts`:
  - Create user, assign to "Maestro", verify row in `app.UserApplications`
  - Retrieve user applications, verify "Maestro" listed
  - Assign to "EYST", verify both "Maestro" and "EYST" returned (no dedup)
  - Assign `all: true`, verify current entries + wildcard row created
  - Attempt duplicate "Maestro" assignment, verify 409
  - Verify `CreateDate`, `CreatedBy`, `UpdateDate`, `UpdatedBy` populated per Principle I

### Implementation for US3

- [x] T025 [US3] Implement POST `/api/admin/users/{userId}/applications` route handler in `src/frontend/app/api/admin/users/[userId]/applications/route.ts`:
  - Validate request: either `applicationId` (specific app) OR `all: true` (wildcard), not both
  - Call `requireAdministrator()` guard (optional auth with seeded admin in develop mode)
  - Call `getUserById(userId)` to verify user exists (return 404 if not)
  - If `applicationId`: call `assignApplication(userId, applicationId)` (handles dedup, returns 409)
  - If `all: true`: call `assignAllApplications(userId)` (MERGE with wildcard, idempotent)
  - Return 201 on success with assignment metadata
  - Return 400 for invalid payload, 404 for missing user, 409 for duplicate
  - Note: In develop mode, seeded admin user may be used if no auth header provided

- [x] T026 [US3] Implement GET `/api/admin/users/{userId}/applications` route handler in `src/frontend/app/api/admin/users/[userId]/applications/route.ts`:
  - Call `getApplicationsByUser(userId)` query
  - Return 200 with array of app assignments (applicationId, applicationName, "all" flag if wildcard)
  - Return 404 if user not found

- [x] T027 [US3] Implement DELETE `/api/admin/users/{userId}/applications/{applicationId}` route handler (optional for MVP) in `src/frontend/app/api/admin/users/[userId]/applications/[applicationId]/route.ts`:
  - Call `unassignApplication(userId, applicationId)` query
  - Return 204 on success, 404 if assignment not found
  - Return 403 if attempting to delete wildcard (special handling per Decision 5)

- [x] T028 [US3] Extend application queries in `src/frontend/lib/db/application-assignments-queries.ts`:
  - `assignAllApplications(userId)` MUST:
    - Query all active apps from `app.Applications` where `IsActive = true`
    - For each app: INSERT into `app.UserApplications` via MERGE (ON DUPLICATE, DO NOTHING)
    - Also INSERT wildcard row with `ApplicationId = "*"` via MERGE
    - MERGE is atomic and ensures no duplicates
    - Populate `CreatedBy` from session context

- [x] T029 [US3] Add application validation in `src/frontend/lib/validation/admin-users.schema.ts`:
  - ApplicationId MUST exist in `app.Applications`
  - `all: true` is mutually exclusive with `applicationId`
  - Validate at least one field present (error if both missing)

**Checkpoint**: User Story 3 complete — users can be assigned to per-app scope or all-apps via idempotent API

---

## Phase 6: User Story 4 - Administrator Deactivates Users (Priority: P1)

**Goal**: Deliver soft-delete API with audit trail preservation

**Independent Test**: Create user (US1), deactivate via PUT `/api/admin/users/{userId}/active` with `isActive: false`, verify user record still exists with flag set, attempt auth, verify rejection; reactivate with `isActive: true`, verify access restored

### Contract & Integration Tests for US4

- [x] T030 [P] [US4] Write contract test in `tests/contract/user-administration/users-active-toggle.test.ts`:
  - Test 200 success case: deactivate (as seeded admin user) returns updated user with `isActive: false`
  - Test 200 success case: reactivate returns updated user with `isActive: true`
  - Test 400 case: missing/invalid `isActive` value
  - Test 404 case: userId not found
  - Test 401/403 cases: unauthenticated (if required), non-administrator
  - Tests use in-memory session fixture to simulate admin context

- [x] T031 [P] [US4] Write integration test in `tests/integration/user-administration/users-active-toggle-flow.test.ts`:
  - Create user (isActive: true), verify in list
  - Deactivate user, verify `IsActive: false` in `app.Users`
  - Verify deactivated user excluded from default list (includeInactive=false)
  - Retrieve user with `?includeInactive=true`, verify visible for audit
  - Verify `UpdateDate` and `UpdatedBy` updated on deactivation
  - Reactivate user, verify `IsActive: true` and included in default list again

### Implementation for US4

- [x] T032 [US4] Implement PUT `/api/admin/users/{userId}/active` route handler in `src/frontend/app/api/admin/users/[userId]/active/route.ts`:
  - Validate request: `isActive` MUST be boolean
  - Call `requireAdministrator()` guard (optional auth with seeded admin in develop mode)
  - Call `getUserById(userId)` to verify user exists (return 404 if not)
  - Call `updateUserActive(userId, isActive)` query
  - Return 200 with updated user (isActive field reflects new state)
  - Return 400 for invalid payload
  - Note: In develop mode, seeded admin user may be used if no auth header provided

- [x] T033 [US4] Extend user queries in `src/frontend/lib/db/users-queries.ts`:
  - `updateUserActive(userId, isActive)` MUST:
    - UPDATE `app.Users` SET `IsActive = @isActive`, `UpdateDate = SYSUTCDATETIME()`, `UpdatedBy = @sessionUser`
    - WHERE `UserId = @userId`
    - Return updated user record
    - Trigger no cascade deletes (soft-delete only)

- [x] T034 [US4] Extend `listUsers()` query in `src/frontend/lib/db/users-queries.ts`:
  - Add optional `includeInactive` parameter (default false)
  - If false: filter WHERE `IsActive = true`
  - If true: return all users regardless of IsActive (for audit views)

- [x] T035 [US4] Add deactivation safeguard (optional, per Decision 4 TBD) in `src/frontend/app/api/admin/users/[userId]/active/route.ts`:
  - Prevent deactivation of last administrator (optional constraint):
    - Count active administrators with role 'administrator'
    - If count == 1 and requested deactivation: return 409 with message "Cannot deactivate last administrator"
    - Alternatively, allow deactivation but warn in response

**Checkpoint**: User Story 4 complete — users can be soft-deleted; audit trail preserved; reactivation supported

---

## Phase 7: User Story 5 - Administrator Access to User Administration Tab (Priority: P2)

**Goal**: Deliver admin-only tab in dashboard navigation and protected route

**Independent Test**: Login as administrator, verify "User Administration" tab visible; login as viewer, verify tab hidden; attempt direct route `/admin/users` as viewer, verify redirect or 403

### Contract & Integration Tests for US5

- [x] T036 [P] [US5] Write UI component test in `tests/integration/user-administration/admin-users-tab-visibility.test.ts`:
  - Test administrator role (via seeded admin fixture): "User Administration" tab rendered and visible in navigation
  - Test application_owner role: tab hidden/not rendered
  - Test viewer role: tab hidden/not rendered
  - Test unauthenticated: tab hidden (develop mode may default to seeded admin, so verify role check logic)
  - Tests may inject session context via Vitest fixtures

- [x] T037 [P] [US5] Write route protection test in `tests/integration/user-administration/admin-users-route-protection.test.ts`:
  - Test administrator: GET `/admin/users` returns 200 with page content
  - Test application_owner: GET `/admin/users` returns 403 or redirects to home
  - Test viewer: GET `/admin/users` returns 403 or redirects to home
  - Test unauthenticated: redirects to login with return URL

### Implementation for US5

- [x] T038 [US5] Create admin users page component in `src/frontend/app/admin/users/page.tsx`:
  - Apply route protection: wrap with `requireAdministrator()` guard (optional auth with seeded admin in develop mode)
  - Render layout with: user list table, create user form, role/app assignment controls (defer specific features to sub-components)
  - Integrate session context for audit logging (CreatedBy, UpdatedBy) — will use seeded admin in develop mode
  - Call `/api/admin/users` on mount to fetch user list
  - Display loading/error states
  - Note: In develop mode, page renders with seeded admin user if no Authorization header provided

- [x] T039 [US5] Create admin users layout wrapper in `src/frontend/app/admin/layout.tsx`:
  - Apply route protection at layout level: check `requireAdministrator()` before rendering child routes
  - If not admin: redirect to `/dashboard` or `/unauthorized` page
  - Render navigation breadcrumb: "Dashboard > User Administration"

- [x] T040 [US5] Create "User Administration" tab component in `src/frontend/components/dashboard/navigation-tabs.tsx` (or similar):
  - Conditionally render "User Administration" tab only if session user role == 'administrator'
  - Tab href: `/admin/users`
  - Tab label: "User Administration"
  - Tab styling: match existing dashboard tab styling (per Motif design system)

- [x] T041 [US5] Create sub-components for US5:
  - `src/frontend/app/admin/users/components/users-list.tsx` — table of users, actions for each row (edit, assign role, assign apps, deactivate/reactivate)
  - `src/frontend/app/admin/users/components/create-user-form.tsx` — form for new user (username, email, displayName)
  - `src/frontend/app/admin/users/components/assign-role-modal.tsx` — modal or dropdown to select role for user
  - `src/frontend/app/admin/users/components/assign-applications-modal.tsx` — checkboxes or toggles for per-app assignment + "All Applications" shortcut
  - Each component MUST:
    - Call appropriate API routes (POST, PUT, GET as needed)
    - Display loading/error states
    - Refresh user list after mutations
    - Use Motif web components for UI consistency

- [x] T042 [US5] Create role-based UI control matrix in `src/frontend/app/admin/users/components/action-controls.tsx`:
  - Administrator: all controls visible and functional (create, assign role, assign apps, deactivate)
  - Application_owner: no controls visible (read-only view, per Principle II)
  - Viewer: no controls visible (read-only view, per Principle II)
  - Per Decision 6: Controls hidden at component level; API guards provide defense-in-depth

- [x] T043 [US5] Add TypeScript types for admin UI in `src/frontend/lib/types/admin.ts`:
  - `AdminUser` type: userId, email, displayName, role, applications[], isActive, createDate, createdBy, updateDate, updatedBy
  - `CreateUserRequest`, `AssignRoleRequest`, `AssignApplicationsRequest` types from contract specs

**Checkpoint**: User Story 5 complete — admin-only tab visible; route protected; user management controls rendered

---

## Phase 8: Integration & Cross-Cutting Concerns

**Purpose**: Polish, error handling, logging, documentation

- [x] T044 [P] Create comprehensive error handling test in `tests/integration/user-administration/error-scenarios.test.ts`:
  - Test 400 (bad request): missing fields, invalid formats, out-of-range values
  - Test 401 (unauthorized): missing session context
  - Test 403 (forbidden): non-admin caller, viewer attempting mutation
  - Test 404 (not found): user/role/app ID doesn't exist
  - Test 409 (conflict): duplicate user, duplicate assignment
  - Test 500 (server error): database connection failure, transaction rollback
  - Verify all errors return structured response per contract (code, message, requestId)

- [x] T045 [P] Create audit logging integration test in `tests/integration/user-administration/audit-logging.test.ts`:
  - Verify every mutation logs to audit table or event log: action, userId, email, timestamp, actor
  - Verify failed mutations also logged with reason
  - Verify sensitive data (passwords, tokens) NOT logged plaintext

- [x] T046 [P] Create performance test in `tests/integration/user-administration/performance.test.ts`:
  - Verify user creation < 500ms p95 (per plan.md goal)
  - Verify user list retrieval < 500ms p95 for 1000 users
  - Verify role/app assignments < 500ms p95
  - Verify admin tab load < 3s under normal load (browser-side test if needed)

- [x] T047 [P] Add logging throughout API routes in `src/frontend/lib/api/request-logger.ts`:
  - Log every request: method, path, caller userId, timestamp
  - Log every response: status code, latency, error message (if any)
  - Log structured audit events for mutations: action, user, old values, new values
  - Do NOT log: passwords, session tokens, PII beyond what's necessary for audit

- [x] T048 [P] Create API documentation in `specs/003-user-admin/API.md`:
  - Document all endpoints from contracts
  - Include curl examples for each endpoint
  - Include error response examples
  - Include request/response schemas

- [x] T049 [P] Create TypeScript JSDoc comments for all public functions:
  - `src/frontend/lib/auth/session.ts`: document `getSessionUser()` return type
  - `src/frontend/lib/auth/guards.ts`: document each guard (purpose, return type, throws)
  - `src/frontend/lib/db/*`: document each query (inputs, outputs, errors, constraints)
  - `src/frontend/app/api/admin/users/*`: document each route (endpoint, payload, response, errors)

- [x] T050 [P] Add TypeScript strict mode validation:
  - Verify `tsconfig.json` has `strict: true`, `noImplicitAny: true`, `noUnusedLocals: true`
  - Run `tsc --noEmit` to verify zero type errors across feature code
  - All callbacks must have explicit return types

- [x] T051 [P] Create feature-level integration test in `tests/integration/user-administration/complete-workflow.test.ts`:
  - End-to-end flow: create user → verify in list → assign role → assign apps → deactivate → verify excluded from list → reactivate → verify restored
  - Verify all audit columns populated and traceable
  - Verify no orphaned data (no user without role, etc.)

- [x] T052 Add README for feature in `specs/003-user-admin/IMPLEMENTATION.md`:
  - Link to spec, plan, research, data-model, contracts
  - Summarize key decisions and trade-offs
  - List dependencies (Epic-001, Epic-010)
  - Link to quickstart.md for local validation
  - List completed tasks and checkpoint status

---

## Phase 9: Pre-Review Checklist

**Purpose**: Ensure code quality, testing, and documentation before PR

- [x] T053 Run full test suite locally:
  - `npm run test` in `src/frontend/` — expect all contract and integration tests PASS
  - `npm run test:coverage` — expect >= 80% coverage for feature code
  - `npm run lint` — expect zero lint errors in feature files
  - `npm run type-check` — expect zero TypeScript errors

- [x] T054 [P] Verify database migrations are idempotent:
  - Run `database/migrations/` against fresh database + migrations + seed scripts
  - Verify `app.Users`, `app.UserRoles`, `app.UserApplications`, `app.Applications`, `app.Roles` tables exist and are seeded correctly
  - Verify unique constraints, foreign keys, default values in place

- [x] T055 [P] Verify seed data is correct:
  - Super-admin user exists with 'administrator' role and all-apps access
  - Three roles seeded: 'administrator', 'application_owner', 'viewer'
  - Five applications seeded: Maestro, EYST, Prodigy, Vector, Navigate
  - All audit columns populated

- [ ] T056 [P] Run feature locally end-to-end:
  - Start database and application per quickstart.md
  - Login as admin
  - Create a new user via UI
  - Assign role and applications
  - Verify in user list
  - Retrieve via API
  - Deactivate and reactivate
  - Logout and verify access denied

- [x] T057 [P] Update `.github/copilot-instructions.md` with feature completion:
  - Add note: "EPIC-BQM-002 (User Administration & RBAC) complete and merged"
  - Ensure agent context reflects updated scope

- [ ] T058 Create pull request in GitHub:
  - Title: "feat: EPIC-BQM-002 - User Administration & Role-Based Access Control"
  - Description: link to spec, summarize scope, note any breaking changes (none expected in MVP)
  - Link to tasks.md checklist
  - Require approval from code reviewer and product owner per project policy

---

## Execution Strategy

### MVP Scope
**Phases 1-4**: ALL REQUIRED—user creation and role assignment are foundational

**Phase 5**: ALL REQUIRED—soft-delete/reactivation essential for compliance

**Phase 6**: ALL REQUIRED—app assignment enables scoped access control

**Phase 7**: RECOMMENDED (P2 but critical for usability)—without UI, admin users must use cURL to manage users

**Phase 8**: ALL REQUIRED—logging and error handling non-negotiable per constitution

**Phase 9**: ALL REQUIRED—code quality gates must pass before merge

### Parallelization Opportunities

- **T002, T003**: Setup tasks can run in parallel
- **T005, T006, T007, T008, T009**: All foundational queries and guards can be implemented in parallel (different files, no dependencies)
- **T011, T012, T018, T019, T023, T024, T030, T031**: All test tasks marked [P] can run in parallel
- **T013-T017** (US1 implementation): T013 and T014 can parallel, depend on T005-T009
- **T020-T022** (US2 implementation): Parallel after US1 complete and T005-T009 complete
- **T025-T029** (US3 implementation): Parallel after US1-US2 complete and T005-T009 complete
- **T032-T035** (US4 implementation): Parallel after US1-US3 complete and T005-T009 complete
- **T038-T043** (US5 implementation): Parallel with earlier user stories after T005 (session layer) complete

### Dependency Graph

```
Setup (T001-T003)
  ↓
Foundational (T004-T010) — MUST COMPLETE BEFORE USER STORIES
  ├─ US1: Create Users (T011-T017)
  │   ├─ Tests: T011-T012
  │   └─ Implementation: T013-T017
  ├─ US2: Assign Roles (T018-T022) [Depends: US1 complete]
  │   ├─ Tests: T018-T019
  │   └─ Implementation: T020-T022
  ├─ US3: Assign Apps (T023-T029) [Depends: US1-US2 complete]
  │   ├─ Tests: T023-T024
  │   └─ Implementation: T025-T029
  ├─ US4: Deactivate (T030-T035) [Depends: US1-US3 complete]
  │   ├─ Tests: T030-T031
  │   └─ Implementation: T032-T035
  └─ US5: Admin Tab (T036-T043) [Soft Depends: US1-US4]
      ├─ Tests: T036-T037
      └─ Implementation: T038-T043
    ↓
Logging & Polish (T044-T052) [Depends: All user stories complete]
  ├─ T044-T048 can parallel
  └─ T049-T051 can parallel
    ↓
Pre-Review (T053-T058) [Depends: All prior phases complete]
  ├─ T053 sequential (blocking gate)
  ├─ T054-T056 can parallel
  └─ T057-T058 final
```

### Estimated Effort

| Phase | # Tasks | Est. Hours | Notes |
|-------|---------|-----------|-------|
| 1. Setup | 3 | 2 | Straightforward structure + config |
| 2. Foundational | 7 | 8 | Core guards, error handling, DB queries |
| 3. US1 (Create) | 7 | 6 | 2 test files, 5 impl, straightforward CRUD |
| 4. US2 (Roles) | 5 | 4 | 2 test files, 3 impl; complex unique constraint enforcement |
| 5. US3 (Apps) | 7 | 6 | 2 test files, 5 impl; idempotentcy + wildcard logic |
| 6. US4 (Deactivate) | 6 | 5 | 2 test files, 4 impl; soft-delete + safeguard |
| 7. US5 (Admin Tab) | 8 | 7 | 2 test files, 6 impl; route protection + components |
| 8. Integration | 9 | 10 | Logging, error scenarios, performance, docs |
| 9. Pre-Review | 6 | 4 | Testing, validation, PR creation |
| **TOTAL** | **58** | **52 hours** | ~6.5 person-days @ 8h/day |

### Recommended Sprint Planning

- **Sprint 1 (Week 1)**: Phases 1-2 (foundational) = ~10 hours
- **Sprint 2 (Week 2)**: Phases 3-4 (US1 + US2) = ~10 hours  
- **Sprint 3 (Week 3)**: Phases 5-6 (US3 + US4) = ~11 hours
- **Sprint 4 (Week 4)**: Phases 7-8 (US5 + logging) = ~17 hours
- **Sprint 5 (Week 5)**: Phase 9 (pre-review + PR) = ~4 hours

---

## Success Criteria

✅ **All 58 tasks completed and checked**  
✅ **All test tasks pass**: contract tests, integration tests, performance tests  
✅ **Code quality gates pass**: lint, type-check, coverage >= 80%  
✅ **Database migrations run cleanly**  
✅ **Feature works end-to-end per quickstart.md**  
✅ **Pull request approved and merged to `develop`**  
✅ **Constitution compliance verified** (all 6 principles)

---

## References

- **Specification**: `specs/003-user-admin/spec.md`
- **plan**: `specs/003-user-admin/plan.md`
- **Research**: `specs/003-user-admin/research.md`
- **Data Model**: `specs/003-user-admin/data-model.md`
- **API Contract**: `specs/003-user-admin/contracts/user-admin-api-contract.md`
- **UI Contract**: `specs/003-user-admin/contracts/admin-ui-access-contract.md`
- **Quickstart**: `specs/003-user-admin/quickstart.md`
- **Constitution**: `.specify/memory/constitution.md`
- **Architecture**: `Documentation/ProjectSpecifications/architecture.md`
