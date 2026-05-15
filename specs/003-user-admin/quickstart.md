# Quickstart - User Administration & RBAC (EPIC-BQM-002)

## Purpose

Guide for validating and developing the User Administration feature locally. Covers API setup,
database prerequisites, UI routes, and test execution.


## Prerequisites

- Branch checked out: `003-user-admin`
- Database foundation (Epic 001) deployed — `app.Users`, `app.Roles`, `app.UserRoles`,
  `app.UserApplications`, `app.Applications` must exist and be seeded
- Super-admin user seeded (from Epic 001 seed scripts)
- Baseline CI workflow active (`EPIC-BQM-010`)
- Node.js 24.x installed
- Authentication context available for local test mode

## 1. Review Feature Inputs

1. Read `specs/003-user-admin/spec.md`.
2. Read `specs/003-user-admin/plan.md`.
3. Review constitution principles in `.specify/memory/constitution.md` (especially Principle IV and V).


## 2. Local Development Setup

### 1. Start the database (if using local SQL Express)

```powershell
.\scripts\database\setup-database.ps1 -UseTrustedConnection
```

This provisions `ATTG_Usage` on `.\SQLEXPRESS` with all schemas and seed data.

### 2. Configure environment

Create `.env.local` in `src/frontend/`:

```env
DATABASE_URL=Server=.\SQLEXPRESS;Database=ATTG_Usage;Trusted_Connection=True;
NEXTAUTH_SECRET=<local-dev-secret>
NEXTAUTH_URL=http://localhost:3000
# MVP: Seeded super-admin user from Epic-001. Used in develop mode if no Authorization header provided.
# To find this UserId, query: SELECT TOP 1 UserId FROM app.Users WHERE IsActive=1 ORDER BY CreateDate DESC
DEV_SESSION_USER_ID=<seeded-admin-userid-from-epic-001>
# Repository mode: true = in-memory repository, false = SQL repository
USE_INMEMORY_REPOSITORY=true
```

**Note**: In MVP develop mode, if no `Authorization` header is provided, the application defaults to `DEV_SESSION_USER_ID`. This enables rapid local iteration on the admin API without needing to mock auth headers on each request. In test mode, session context is injected by Vitest fixtures. In Extended-MVP, replace this with Azure AD SSO via NextAuth (single-file `lib/auth/session.ts` change).

**Repository Mode Note**:
- Unit tests MUST run with `USE_INMEMORY_REPOSITORY=true` for deterministic isolation.
- Local testing can run either mode:
  - `USE_INMEMORY_REPOSITORY=true` (fast local iteration)
  - `USE_INMEMORY_REPOSITORY=false` (SQL parity validation)
- SQL mode security requirement: all queries must use parameterized bindings only (`mssql` request inputs), never dynamic SQL string interpolation.

### 3. Run the application

```bash
cd src/frontend
npm install
npm run dev
```

Open `http://localhost:3000`.


## 3. Validation Flow

#### API Validation

Run these against `http://localhost:3000/api`:

```bash
# 1. List users (expect super-admin)
curl http://localhost:3000/api/users

# 2. Create a user
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"username":"test-owner","email":"owner@example.com","displayName":"Test Owner","isActive":true}'

# 3. Assign role
curl -X PUT http://localhost:3000/api/users/<userId>/roles \
  -H "Content-Type: application/json" \
  -d '{"roleId":"20000000-0000-0000-0000-000000000002"}'

# 4. Assign all applications
curl -X POST http://localhost:3000/api/users/<userId>/applications \
  -H "Content-Type: application/json" \
  -d '{"all":true}'

# 5. Deactivate user
curl -X PUT http://localhost:3000/api/users/<userId> \
  -H "Content-Type: application/json" \
  -d '{"isActive":false}'

# 6. Verify record still exists (soft-delete)
curl http://localhost:3000/api/users?includeInactive=true

# 7. Replace user role (exactly-one-role enforcement)
curl -X PUT http://localhost:3000/api/users/<userId>/roles \
  -H "Content-Type: application/json" \
  -d '{"roleId":"20000000-0000-0000-0000-000000000003"}'

# 8. List user applications
curl http://localhost:3000/api/users/<userId>/applications

# 9. Remove one application assignment
curl -X DELETE http://localhost:3000/api/users/<userId>/applications/10000000-0000-0000-0000-000000000001
```

Repository mode switch examples:

```powershell
# In-memory repository mode (recommended for unit-style local testing)
$env:USE_INMEMORY_REPOSITORY='true'; npm run dev

# SQL repository mode (recommended for local integration parity)
$env:USE_INMEMORY_REPOSITORY='false'; npm run dev
```

#### UI Validation

1. Log in as a user with `administrator` role.
2. Confirm the **User Administration** tab is visible in the nav.
3. Confirm the user list shows the seeded super-admin and any created users.
4. Create a new user via the form — verify it appears in the list.
5. Assign a role and applications — verify changes persist on page reload.
6. Deactivate the test user — verify it disappears from the default list.
7. Enable "Show Inactive" toggle — verify deactivated user reappears.
8. Log in as a user with `application_owner` or `viewer` role.
9. Confirm the **User Administration** tab is **not visible**.
10. Attempt direct navigation to `/admin/users` — confirm redirect occurs.

#### Authorization Tests

```bash
# Non-admin session should receive 403 on all mutations
# Set DEV_SESSION_USER_ID to a viewer userId, then:
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"username":"x","email":"x@x.com","isActive":true}'
# Expected: 403 FORBIDDEN
```

#### One-Role Constraint Validation

```sql
-- Run against ATTG_Usage after assigning multiple roles via API
SELECT UserId, COUNT(*) AS RoleCount FROM app.UserRoles GROUP BY UserId HAVING COUNT(*) > 1;
-- Expected: 0 rows
```

#### Duplicate Assignment Validation

```sql
-- Run after using the All Applications shortcut twice
SELECT UserId, ApplicationId, COUNT(*) AS DupeCount
FROM app.UserApplications GROUP BY UserId, ApplicationId HAVING COUNT(*) > 1;
-- Expected: 0 rows
```

### Test Files

| Test | Path |
|------|------|
| API contract tests | `tests/contract/user-administration/` |
| API integration tests | `tests/integration/user-administration/` |
| UI component tests | `src/frontend/__tests__/admin/` |
| Playwright E2E tests | `tests/e2e/admin-users.spec.ts` |

Run all tests:

```bash
npm test
npx playwright test tests/e2e/admin-users.spec.ts
```

Optional targeted suites:

```bash
npm test -- tests/contract/user-administration/api-users-role.contract.ts
npm test -- tests/contract/user-administration/api-users-applications.contract.ts
npm test -- tests/integration/user-administration/role-enforcement.integration.ts
npm test -- tests/integration/user-administration/application-assignment.integration.ts
```

### Known Development Notes

- In MVP the session user is determined by `DEV_SESSION_USER_ID` env var. In Extended-MVP
  this is replaced by NextAuth session.
- The seeded super-admin userId is `30000000-0000-0000-0000-000000000001`.
- Role seed IDs: administrator = `20000000-0000-0000-0000-000000000001`,
  application_owner = `20000000-0000-0000-0000-000000000002`,
  viewer = `20000000-0000-0000-0000-000000000003`.

## 4. Implement Tests First

1. Add/extend contract tests under `tests/contract/user-administration/`:
   - Create user (201)
   - Duplicate identity key (409)
   - Missing required fields (400)
   - Role update semantics (exactly one role)
   - Application assignment dedupe (409)
   - Admin-only endpoint access (401/403)
2. Add integration tests under `tests/integration/user-administration/`:
   - End-to-end create -> assign role -> assign app -> deactivate -> access denied
   - Non-admin route access blocked for `/dashboard/admin/users`

## 5. Implement API and Authorization Logic

1. Implement admin user routes under `src/frontend/app/api/admin/users/`.
2. Implement/extend RBAC enforcement in `src/frontend/lib/auth/`.
3. Ensure audit column updates are applied for every mutation.
4. Enforce soft-delete only (`IsActive` toggle), no hard deletes.

## 6. Implement Admin UI Access Controls

1. Add/adjust admin tab visibility in dashboard navigation.
2. Add route guard for `/admin/users`.
3. Build user management controls for create, role update, app assignment, deactivate/reactivate.

## 7. Validate Locally

1. Run lint and type checks.
2. Run contract and integration tests.
3. Verify admin and non-admin behavior manually in local environment.
4. Verify dependency security checks required by constitution policy for changed ecosystems.

## 8. Merge Readiness Checklist

- All tests pass deterministically.
- No unresolved clarifications in spec/plan.
- RBAC checks return expected 401/403/409 responses.
- Audit metadata populated on all mutating operations.
- User administration tab and route are admin-only.
- PR includes evidence of lint/type-check/tests and dependency security validation.
