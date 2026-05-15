# Research: EPIC-BQM-005 Authentication and Authorization

## R1 - Authentication Mode and Session Derivation

**Task**: Determine how protected routes and APIs should derive authenticated user context while aligning with Azure AD SSO goals and existing runtime behavior.

**Decision**: Keep authentication enforcement centered on session resolution (`lib/auth/session.ts`) and route guards (`lib/auth/guards.ts`). Protected flows require an authenticated session (`requireAuthenticated`/`requireActive`), while development fallback (`DEV_SESSION_USER_ID`) remains non-production-only behavior.

**Rationale**:
- Aligns with constitution Principle V and stakeholder expectation that anonymous access is prohibited.
- Preserves current local developer productivity pattern without relaxing production security posture.
- Avoids duplicating session parsing in each route.

**Alternatives considered**:
- Per-route manual authentication logic: rejected due to inconsistency and leakage risk.
- Directly embedding auth decisions in UI components only: rejected because server-side enforcement must be authoritative.

---

## R2 - Role Enforcement Boundary

**Task**: Identify the correct boundary for role checks (`administrator`, `application_owner`, `viewer`) across APIs and route access.

**Decision**: Centralize role-based checks in guard/assert functions (`requireAdministrator`, role assertions in auth modules) and keep route handlers as adapters that call these checks before executing business behavior.

**Rationale**:
- Clean Architecture compliance: security decisions belong in shared auth logic and service boundaries, not duplicated route code.
- Supports consistent behavior for direct route navigation and API invocation.

**Alternatives considered**:
- Scattered inline role checks in every route: rejected due to drift and maintenance risk.
- Repository-layer only authorization: rejected because route/action authorization must occur before business processing starts.

---

## R3 - Application Scope Enforcement

**Task**: Define how non-admin users are constrained to assigned applications on reads and mutating operations.

**Decision**: Enforce application scope using existing session `applications` membership (`*` or specific app IDs) plus server-side assertions at service/auth boundaries for every protected app-scoped operation.

**Rationale**:
- Matches constitution and stakeholder requirements for least privilege.
- Prevents client-side bypass attempts.
- Reuses existing role and assignment model from `app.UserApplications`.

**Alternatives considered**:
- UI filtering only: rejected because unauthorized API access could still leak data.
- Global broad access for non-admins: rejected as non-compliant with EPIC-BQM-005.

---

## R4 - Error Contract for Unauthorized Access

**Task**: Standardize unauthorized response behavior to prevent internal detail leakage.

**Decision**: Maintain strict 401 vs 403 semantics through shared `AppError` handling: 401 for unauthenticated requests, 403 for authenticated users lacking permission or active status.

**Rationale**:
- Explicit EPIC acceptance criteria and architecture requirements.
- Supports reliable contract testing and predictable client behavior.

**Alternatives considered**:
- Returning only 403 for all denied requests: rejected as semantically incorrect and harder for clients to handle.
- Verbose technical error bodies: rejected due to leakage risk.

---

## R5 - Admin Route Protection

**Task**: Ensure User Administration route/tab is inaccessible to non-admin users, including direct URL navigation.

**Decision**: Keep admin route evaluation via centralized admin access evaluation (`lib/auth/admin-access.ts`) and enforce matching API-side admin guards.

**Rationale**:
- Provides consistent behavior across SSR route access and API actions.
- Keeps redirection and forbidden handling explicit and testable.

**Alternatives considered**:
- Navigation-level hide only: rejected because direct URL access remains possible.

---

## R6 - Deterministic Security Testing Strategy

**Task**: Choose test strategy that satisfies constitution deterministic-isolation requirements while covering role/scope matrix.

**Decision**: Validate authorization through contract + integration tests using in-memory repositories and explicit role/application session contexts; include route, API, and scope scenarios for each role class.

**Rationale**:
- Constitution Principle IV requires deterministic, isolated tests.
- Existing test suite structure already supports this model.

**Alternatives considered**:
- External identity provider dependency in CI tests: rejected due to non-determinism and environment coupling.

---

## R7 - Initial Administrator Availability

**Task**: Determine how initial privileged access is guaranteed for bootstrap and local operation.

**Decision**: Continue to rely on SQL seed scripts (`seed-superadmin.sql`) executed by migration sequence (`005_run_seed_scripts.sql`) to provision the initial super-admin user and all-application assignments.

**Rationale**:
- Constitution mandates seeded super-admin on initial deployment.
- Existing development and test conventions already map to this seed identity.

**Alternatives considered**:
- Manual one-off administrator provisioning: rejected as non-repeatable and brittle.
