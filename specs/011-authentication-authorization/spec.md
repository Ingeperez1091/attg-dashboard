# Feature Specification: EPIC-BQM-005 Authentication and Authorization

**Feature Branch**: `011-authentication-authorization`  
**Created**: 2026-05-08  
**Status**: Draft  
**Input**: User description: "Work on epic-005-authentication-autorization"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Enforce Authenticated Access (Priority: P1)

As an enterprise dashboard user, I want to sign in with my corporate identity and be blocked when not signed in, so that sensitive adoption and revenue data is never exposed anonymously.

**Why this priority**: Authentication is the first security boundary. Without it, all downstream authorization controls are ineffective.

**Independent Test**: Can be fully tested by requesting protected pages and APIs with and without an active session and verifying authenticated access succeeds while anonymous access is blocked.

**Acceptance Scenarios**:

1. **Given** a user without an active session, **When** they request a protected dashboard page, **Then** access is denied and they are directed to authenticate.
2. **Given** a user with a valid session, **When** they return to the dashboard after sign-in, **Then** they can access allowed dashboard content.
3. **Given** an unauthenticated caller, **When** any protected API endpoint is invoked, **Then** the response is 401 without internal implementation detail.

---

### User Story 2 - Enforce Role-Based Route and Action Protection (Priority: P1)

As a platform owner, I want each role to have only permitted route and action access, so that administrative and configuration capabilities are restricted to authorized users.

**Why this priority**: Route and action protection is the second core security gate after sign-in and prevents privilege misuse.

**Independent Test**: Can be tested by exercising the same routes/actions across administrator, application_owner, and viewer sessions and confirming allowed/denied behavior by role.

**Acceptance Scenarios**:

1. **Given** a viewer user, **When** they try to access User Administration, **Then** access is denied.
2. **Given** an application owner, **When** they attempt an admin-only action, **Then** the request is rejected with 403.
3. **Given** an administrator, **When** they access protected administrative functions, **Then** access is granted.
4. **Given** an unauthorized authenticated user, **When** they call a restricted API, **Then** the response is 403 without internal detail leakage.

---

### User Story 3 - Enforce Application-Scoped Data Visibility (Priority: P1)

As an application owner or viewer, I want to see only the applications assigned to me, so that data access follows least-privilege boundaries.

**Why this priority**: Role-only gating is insufficient without data scoping; unauthorized data exposure risk remains unless response datasets are scoped.

**Independent Test**: Can be tested by assigning a user to a subset of applications and verifying all dashboard/API responses exclude unassigned application data.

**Acceptance Scenarios**:

1. **Given** a user assigned to specific applications, **When** they open dashboard and reporting views, **Then** only assigned application data is visible.
2. **Given** a user requesting data for an unassigned application, **When** the request is processed, **Then** access is rejected with 403.
3. **Given** an administrator, **When** data is requested, **Then** all in-scope application data is available.

---

### User Story 4 - Azure AD SSO Login and Identity Bridge (Priority: P1)

As an enterprise dashboard user, I want to sign in using my corporate Microsoft account (via Azure AD / Microsoft Entra ID), so that my authenticated identity is automatically linked to my dashboard role and application permissions without a separate credential store.

**Why this priority**: Enforcing authenticated access (US1) depends on a real enterprise login flow. Without the SSO handshake and identity bridge, protected routes can only rely on development fallbacks. This story closes the gap between the session enforcement already in place and a production-grade login mechanism.

**Independent Test**: Can be tested by simulating an Auth.js v5 JWT session carrying an AAD object ID, verifying `getOptionalSession` resolves to the correct internal principal via `findByAzureAdObjectId`, and confirming unauthenticated browser navigation redirects to `/login`.

**Acceptance Scenarios**:

1. **Given** an unauthenticated user navigating to any protected route, **When** they are processed by the edge middleware, **Then** they are redirected to `/login` with a `returnUrl` parameter.
2. **Given** a user on the `/login` page, **When** they click the Microsoft sign-in button, **Then** they are redirected to Microsoft Entra ID for authentication.
3. **Given** a user who completes sign-in at Microsoft Entra ID, **When** Auth.js processes the callback, **Then** an internal session principal is resolved using the AAD object ID (`oid` claim) matched to their `azureAdObjectId` in `app.Users`, and the session carries their correct internal `userId`, `role`, and application scope.
4. **Given** a successfully authenticated user, **When** they are redirected back to the application, **Then** they land on the original `returnUrl` page and access is granted according to their role and application scope.
5. **Given** the development environment, **When** `DEV_SESSION_USER_ID` is set and no Auth.js cookie is present, **Then** the seeded super-admin session is used as before (no regression to local development workflow).

---

### Edge Cases

- What happens when a user account is deactivated after a valid session is created? Access must be denied on subsequent authorization checks.
- How does the system handle role or application assignment changes during an active session? Updated permissions must take effect on the next request.
- What happens when a user has no assigned applications and is not an administrator? Protected data endpoints must return no scoped data and reject explicit unassigned application access.
- How does the system respond to malformed or missing identity claims? The request must be treated as unauthenticated and return 401.
- What happens when a user attempts direct URL navigation to restricted routes? The route must not render restricted content and must deny access.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST require authenticated enterprise sign-in for all protected dashboard and API experiences; anonymous access is prohibited.
- **FR-002**: The system MUST establish a valid user session after successful enterprise sign-in and use that session for subsequent access decisions.
- **FR-003**: The system MUST support exactly three role types for authorization: `administrator`, `application_owner`, and `viewer`.
- **FR-004**: The system MUST enforce a single active role per user at any point in time.
- **FR-005**: The system MUST enforce role-based route and action permissions, including restricting User Administration to administrators only.
- **FR-006**: The system MUST enforce server-side authorization checks on all protected API endpoints before business processing begins.
- **FR-007**: The system MUST return 401 for unauthenticated requests and 403 for authenticated-but-unauthorized requests.
- **FR-008**: The system MUST return authorization error responses that do not expose internal implementation details.
- **FR-009**: The system MUST scope application data returned to `application_owner` and `viewer` users to their assigned applications only.
- **FR-010**: The system MUST allow `administrator` users to access data and functions across all applications.
- **FR-011**: The system MUST ensure role and application assignment changes are enforced on subsequent authorization checks.
- **FR-012**: The system MUST preserve auditability by associating authenticated user identity with governed changes and protected operations.
- **FR-013**: The system MUST block direct navigation to restricted routes when the user lacks required permissions.
- **FR-014**: The system MUST maintain current platform behaviors for non-security business functions while adding authentication and authorization controls.
- **FR-015**: The system MUST use Auth.js v5 (`next-auth@beta`) with the Microsoft Entra ID provider as the production authentication mechanism; the login flow MUST redirect to Azure AD and return an authenticated session on success.
- **FR-016**: The system MUST bridge the Azure AD identity (AAD object ID / `oid` claim) to an internal user record via `azureAdObjectId` in `app.Users`; unrecognized Azure AD identities that have no matching internal user MUST be treated as unauthenticated (401).
- **FR-017**: On the first successful SSO login for a known internal user where `azureAdObjectId` is currently null/empty, the system MUST persist the Azure AD object ID from the authenticated `oid` claim and emit an audit log for this identity-binding event.
- **FR-018**: `azureAdObjectId` MUST be system-managed: it is not required during admin user creation and cannot be manually edited through admin create/edit UI or API payloads.

### Key Entities *(include if feature involves data)*

- **User Session**: Represents an authenticated principal context used to evaluate role and scope on each protected request.
- **User Role Assignment**: Represents the single authorized role associated with a user (`administrator`, `application_owner`, `viewer`).
- **User Application Scope**: Represents the set of applications a non-admin user is allowed to access.
- **Authorization Decision**: Represents the allow/deny outcome for a request, including whether denial is due to missing authentication or insufficient permission.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of protected page and API access attempts without authentication are denied.
- **SC-002**: 100% of unauthorized protected API calls return correct status semantics (401 unauthenticated, 403 unauthorized).
- **SC-003**: In role-based validation testing, 100% of administrator, application_owner, and viewer permission scenarios match the defined access matrix.
- **SC-004**: In scoped-data validation testing, 100% of non-admin responses exclude unassigned application data.
- **SC-005**: 100% of restricted-route direct navigation attempts by non-authorized roles are blocked from viewing restricted content.
- **SC-006**: Authentication and authorization change sets pass all required quality gates (lint, type-check, automated tests) before release.
- **SC-007**: For authenticated and authorized users, baseline non-security business behaviors remain unchanged for covered endpoints (`GET /api/metrics/:appId`, `GET /api/applications/:appId/numeratormodel`, `GET /api/filters/numerator/:appId`, `GET /api/filters/denominator/:appId`) with 100% parity on response contract shape and business fields versus pre-change fixtures.
- **SC-008**: Existing user-facing non-security error behavior remains stable: for authorized requests with downstream dependency failures, 100% of covered UI/API flows continue returning the established generic failure semantics (for example, "Failed to load data") without introducing auth-layer regressions.
- **SC-009**: The Auth.js v5 SSO integration compiles, the `getOptionalSession` AAD-OID-to-principal bridge resolves correctly in contract and integration tests, and all existing auth/authz suites remain green after session.ts is updated.
- **SC-010**: In automated auth tests, first successful SSO login binds `azureAdObjectId` exactly once for users missing the value, while admin user create/edit flows accept payloads without `azureAdObjectId` and reject/ignore manual updates to that field.

## Assumptions

- Azure AD tenant configuration and enterprise identity setup are available for this feature.
- Existing user, role, and user-application assignment data remains the authoritative source for authorization scope.
- No new role types are introduced in this feature beyond `administrator`, `application_owner`, and `viewer`.
- User Administration feature ownership remains separate; this feature enforces access boundaries around it rather than redefining its business scope.
- Existing APIs and dashboard views remain functionally in scope; this feature adds security enforcement without redefining unrelated business workflows.
