# Feature Specification: User Administration & Role-Based Access Control (EPIC-BQM-002)

**Feature Branch**: `003-user-admin`  
**Created**: 2026-04-14   
**Status**: Ready  
**Epic**: [EPIC-BQM-002 — User Administration & RBAC](../../Documentation/Backlog/epics/epic-002-user-administration.md)  
**Constitution**: [BTS Quarterly Metrics Dashboard Constitution](../../.specify/memory/constitution.md) v1.0.0 (Principle V)  
**Architecture Reference**: [System Architecture](../../Documentation/ProjectSpecifications/architecture.md) § 4.1, 4.2, 7

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Administrator Creates New Users (Priority: P1)

As an **Administrator**, I need to create new users with core identity fields so that team members can be onboarded to the dashboard without engineering intervention.

**Why this priority**: User creation is the foundational operation for all RBAC. Without this capability, administrators cannot onboard new team members. It directly enables role-based access control.

**Independent Test**: Can be fully tested by submitting a valid user creation request with identity key, email, display name, and active state, then verifying the user record is persisted and retrievable.

**Acceptance Scenarios**:

1. **Given** I am authenticated as an administrator, **When** I submit a user creation request with valid identity key, email, display name, and active state, **Then** the system creates the user record and returns HTTP 201 with the new user ID and confirmation.

2. **Given** a user has been created successfully, **When** I retrieve the user record, **Then** all submitted fields are persisted exactly as provided, and audit columns (CreateDate, CreatedBy) are populated.

3. **Given** I submit a user creation request with a duplicate identity key, **When** the system processes it, **Then** it returns HTTP 409 (Conflict) and prevents the duplicate.

4. **Given** I submit a user creation request with missing required fields (e.g., missing email), **When** the system processes it, **Then** it returns HTTP 400 with a clear error message identifying the missing field.

---

### User Story 2 - Administrator Assigns Exactly One Role Per User (Priority: P1)

As an **Administrator**, I need to assign exactly one role (administrator, application_owner, or viewer) per user so that access control is unambiguous and secure.

**Why this priority**: Role assignment directly enforces the security model defined in the constitution. The constraint "exactly one role per user" is foundational to RBAC. Without this, users could have conflicting permissions.

**Independent Test**: Can be fully tested by creating a user, assigning a role, attempting to assign a second role (which should fail), and verifying the user has exactly one active role.

**Acceptance Scenarios**:

1. **Given** I am authenticated as an administrator and a user exists with no role assigned, **When** I assign the `application_owner` role, **Then** the user record is updated and subsequent auth checks recognize the new role.

2. **Given** a user has the `viewer` role assigned, **When** I attempt to add a second role (`application_owner`) without removing the first, **Then** the system returns HTTP 400 and prevents the dual-role assignment.

3. **Given** I want to change a user's role from `viewer` to `administrator`, **When** I update the role, **Then** the old role is removed and the new role is active in subsequent requests.

4. **Given** a user has a role assigned, **When** I retrieve the user record, **Then** exactly one `role` field exists on the user object with the assigned value.

---

### User Story 3 - Administrator Assigns Users to Applications (Priority: P1)

As an **Administrator**, I need to assign users to one or many applications (with an "All Applications" shortcut) so that application_owners and viewers have scoped access to only their assigned applications.

**Why this priority**: Application assignment is the second dimension of RBAC (role × applications). Without this, users cannot be scoped to specific applications. The "All Applications" shortcut is critical for super-admin configuration.

**Independent Test**: Can be fully tested by assigning a user to multiple applications (including "All Applications"), verifying the relationships are stored, and confirming deduplication prevents duplicate assignments.

**Acceptance Scenarios**:

1. **Given** a user with `application_owner` role exists and I am authenticated as an administrator, **When** I assign the user to application "Maestro", **Then** the UserApplication relationship is created and the user can subsequently access Maestro-scoped operations.

2. **Given** a user is already assigned to "Maestro", **When** I assign the same user to "Maestro" again, **Then** the system detects the duplicate and returns HTTP 409 without creating a duplicate entry.

3. **Given** I want to grant a user access to all five applications (Maestro, EYST, Prodigy, Vector, Navigate), **When** I assign the user to the "All Applications" special value, **Then** the user has implicit access to all present and future applications.

4. **Given** a user is assigned to "Maestro" and "EYST", **When** I retrieve the user's application assignments, **Then** both applications are listed and the user's data visibility is scoped accordingly.

5. **Given** a user with `viewer` role is assigned to "Maestro", **When** that user attempts to access "EYST" data, **Then** they receive HTTP 403 (Forbidden) response.

---

### User Story 4 - Administrator Deactivates Users (Priority: P1)

As an **Administrator**, I need to soft-delete (deactivate) users so that access can be revoked without losing audit history.

**Why this priority**: Deactivation is the safe counterpart to user creation. Hard deletion would break audit trails. Soft deletion is essential for compliance and incident response.

**Independent Test**: Can be fully tested by deactivating a user, verifying the `IsActive` flag is set to false, and confirming subsequent auth attempts fail for that user.

**Acceptance Scenarios**:

1. **Given** an active user exists and I am authenticated as an administrator, **When** I deactivate the user, **Then** the user's `IsActive` flag is set to false and an update audit column is populated.

2. **Given** a user has been deactivated, **When** they attempt to authenticate or access dashboard operations, **Then** the system returns HTTP 401/403 and access is denied.

3. **Given** a deactivated user exists in the system, **When** an administrator retrieves the user record, **Then** the user is visible with `IsActive = false` for audit purposes (no hard delete).

4. **Given** a user has been deactivated and later needs to be reactivated, **When** the administrator sets `IsActive = true`, **Then** the user's access is restored without recreating the user.

---

### User Story 5 - Administrator Access to User Administration Tab (Priority: P2)

As an **Administrator**, I need the User Administration tab to be visible in the dashboard navigation so I can access user management UI.

**Why this priority**: The admin UI tab is the primary interface for user management. P2 (not P1) because the API operations (create, assign, deactivate) are more critical than the UI, but the UI is essential for usability.

**Independent Test**: Can be fully tested by logging in as an administrator, verifying "User Administration" tab is visible, navigating to it, and confirming non-admin users cannot access the tab even via direct route.

**Acceptance Scenarios**:

1. **Given** I am authenticated as an administrator, **When** I view the dashboard navigation, **Then** the "User Administration" tab is visible and clickable.

2. **Given** a non-administrator user (viewer) is authenticated, **When** they view the dashboard navigation, **Then** the "User Administration" tab is hidden.

3. **Given** I am a non-administrator user and I attempt to navigate directly to the User Administration route (e.g., `/admin/users`), **When** the route loads, **Then** I am redirected to an unauthorized page or the dashboard home, and the admin content is not rendered.

4. **Given** I access the User Administration tab as an administrator, **When** the tab loads, **Then** user management controls (create user, assign role, assign applications, deactivate) are visible and functional.

---

### Edge Cases

- **What happens if an administrator tries to create a user with an identity key that already exists?** The system returns HTTP 409 (Conflict) and prevents the duplicate, preserving the existing user.
- **What if a user's role is changed while they are actively logged in?** The new role takes effect on the next request; the user is not forcefully logged out but their access is re-evaluated per request.
- **What if all applications are deleted while a user is assigned to "All Applications"?** The assignment remains valid; if applications are recreated, the user retains access.
- **What happens if a user is deactivated while they are logged in?** The user's session is not immediately revoked, but subsequent requests after deactivation check `IsActive` and deny access.
- **Can an administrator remove their own administrator role?** The system should allow it but warn the user; alternatively, a constraint can prevent self-removal to avoid locking out all admins (TBD: clarification needed).

---

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

---

## Requirements *(mandatory)*

### Functional Requirements

**User Management APIs**:

- **FR-001**: System MUST expose a POST `/api/admin/users` endpoint that accepts user creation requests with identity key (AzureADObjectId), email, display name, and active state (all required).

- **FR-002**: System MUST validate that the requesting user is authenticated with the `administrator` role before accepting any user management request (FR-001 through FR-012).

- **FR-003**: System MUST create a new user record in `app.Users` table and return HTTP 201 with the new user ID, confirmation message, and audit timestamps (CreateDate, CreatedBy).

- **FR-004**: System MUST enforce uniqueness on the identity key (AzureADObjectId) field; if a user with the same identity key already exists, return HTTP 409 (Conflict) without creating a duplicate.

- **FR-005**: System MUST validate all required user fields are present; missing fields return HTTP 400 with error identifying the missing field.

- **FR-006**: System MUST expose a PUT `/api/admin/users/{userId}/role` endpoint that accepts a single role value (administrator, application_owner, or viewer) and assigns it to the user.

- **FR-007**: System MUST enforce exactly one role per user at all times. If a user already has a role and a new role is assigned, the old role MUST be removed before the new role is applied (atomic operation).

- **FR-008**: System MUST return HTTP 400 if a role assignment request includes multiple roles or an invalid role value; valid values are: `administrator`, `application_owner`, `viewer`.

- **FR-009**: System MUST expose a POST `/api/admin/users/{userId}/applications` endpoint that accepts a single application ID or the special value `"*"` (all applications) and creates a UserApplication relationship.

- **FR-010**: System MUST enforce uniqueness on (UserId, ApplicationId) combinations; duplicate assignments return HTTP 409 without creating duplicate entries.

- **FR-011**: System MUST support the special "All Applications" assignment by storing `ApplicationId = "*"`. Users with this assignment have implicit access to all applications, including those created in the future.

- **FR-012**: System MUST expose a PUT `/api/admin/users/{userId}/active` endpoint that accepts an `isActive` boolean flag and soft-deletes (deactivates) or reactivates the user by setting `IsActive` to the provided value.

- **FR-013**: System MUST return HTTP 404 if a user ID does not exist when attempting to update role, applications, or active status.

**Authentication & Authorization**:

- **FR-014**: System MUST require all admin endpoints (FR-001 through FR-012) to be protected by authentication; unauthenticated requests return HTTP 401.

- **FR-015**: System MUST verify that the requesting user has the `administrator` role; non-administrator requests to user management endpoints return HTTP 403.

- **FR-016**: System MUST include the requesting user's ID in the `CreatedBy` and `UpdatedBy` audit columns for all user, role, and application assignment operations.

**Role-Based Access Control Enforcement**:

- **FR-017**: System MUST evaluate user authorization on every API request by checking: (1) user is authenticated, (2) user is active (`IsActive = true`), (3) user has appropriate role, (4) user is assigned to the requested application(s).

- **FR-018**: System MUST deny access (HTTP 403) if an application_owner user attempts to access operations for an application they are not assigned to.

- **FR-019**: System MUST deny access (HTTP 403) if a viewer user attempts to modify filter configuration, user administration, or any write operation.

- **FR-020**: System MUST allow an `administrator` user to access all applications and all functionality.

**User Administration Tab (UI)**:

- **FR-021**: System MUST render the "User Administration" tab in the dashboard navigation only if the authenticated user has the `administrator` role.

- **FR-022**: System MUST hide the "User Administration" tab from non-administrator users regardless of which dashboard tab they are viewing.

- **FR-023**: System MUST block access to the User Administration route (`/admin/users`) by returning HTTP 403 or redirecting to home if the authenticated user is not an administrator.

- **FR-024**: System MUST render the User Administration tab with user management controls (create user form, role assignment dropdown, application assignment checkboxes or "All Applications" toggle, deactivate button).

**Input Validation & Sanitization**:

- **FR-025**: System MUST validate email format; invalid emails return HTTP 400 with a clear error message.

- **FR-026**: System MUST sanitize all text input (identity key, email, display name) against injection attacks (SQL injection, XSS, etc.) before storage or processing.

- **FR-027**: System MUST enforce reasonable length limits on text fields (e.g., display name max 255 characters, email max 320 characters).

**Data Integrity**:

- **FR-028**: System MUST populate `CreateDate` and `CreatedBy` audit columns when a user is created.

- **FR-029**: System MUST populate `UpdateDate` and `UpdatedBy` audit columns whenever a user record (including role or application assignments) is modified.

- **FR-030**: System MUST never hard-delete user records; deactivation sets `IsActive = false` and preserves the record for audit purposes.

### Key Entities *(include if feature involves data)*

- **Users**: Represents a person who can access the dashboard. Key attributes include identity key, email, display name, active state, and audit metadata.
  - `UserId` (PK, identity key from internal system)
  - `Email` (string, unique, required)
  - `DisplayName` (string, required)
  - `AzureADObjectId` (string, Provided by ADO integration or by user creator)
  - `Role` (string: `administrator` | `application_owner` | `viewer`, required, exactly one)
  - `IsActive` (boolean, default true)
  - `CreateDate`, `CreatedBy`, `UpdateDate`, `UpdatedBy` (audit columns)

- **Applications**: Represents an application domain that can be assigned for user visibility scope. The five supported applications (Maestro, EYST, Prodigy, Vector, Navigate)
  - `ApplicationId` (PK, string)
  - `ApplicationName` (string)
  - `IsActive` (boolean)
  - `ServiceLine`, `SubServiceLine` (for categorization)

- **UserApplications**: Represents each user-to-application authorization relationship; duplicates are not allowed.
  - `UserId` (FK → Users)
  - `ApplicationId` (FK → Applications, or special value `"*"` for all applications)
  - Unique constraint on (UserId, ApplicationId)
  - `CreateDate`, `CreatedBy` (audit columns)

- **Roles**: Represents one authorization level assigned to a user. Allowed values are administrator, application owner, and viewer.
  - `RoleName` (string: `administrator` | `application_owner` | `viewer`)
  - `Description` (string)

- **UserRole Assignment**: Represents the one-to-one effective role state for each user at a point in time.
---

## Success Criteria *(mandatory)*

> **Definition**: Measurable outcomes that validate the feature delivers its designed value.

1. **User Creation Success Rate**: 100% of valid user creation requests (with all required fields) succeed and persist correctly. Invalid requests (missing fields, duplicates) are rejected with HTTP 400/409 and clear error messages.

2. **Role Enforcement**: 100% of user records have exactly one active role. Attempting to assign a second role without removing the first fails with HTTP 400. Role changes are immediately reflected in subsequent auth checks.

3. **Application Assignment Accuracy**: 100% of application assignments are unique (No duplicates); "All Applications" special value works as designed (grants access to all apps). Attempting duplicate assignments returns HTTP 409.

4. **Access Control Correctness**: All authentication and authorization checks work correctly:
   - Unauthenticated users cannot access admin endpoints (401)
   - Non-administrator users cannot access admin endpoints (403)
   - Application_owners cannot access apps they're not assigned to (403)
   - Deactivated users cannot authenticate or access operations (401/403)

5. **Tab Visibility & Route Protection**: User Administration tab is visible only to administrators; hidden from all others. Non-admin users cannot access `/admin/users` route (HTTP 403 or redirect); admin content is not rendered.

6. **Audit Trail Completeness**: 100% of user creation, role assignment, and application assignment operations generate audit log entries with user ID, operation type, timestamp, and requesting user ID.

7. **Data Integrity**: Deactivated users are never hard-deleted; records remain visible for audit with `IsActive = false`. Soft-deletion preserves audit history.

8. **Input Validation**: 100% of invalid inputs (bad email format, injection attempts, oversized fields) are rejected with HTTP 400 and descriptive error messages. Zero injection vulnerabilities.

9. **Regression Prevention**: All user administration pull requests pass baseline CI quality gates: lint, type-check, and automated tests (unit + integration tests 100% passing).

---

## Assumptions

- **A-001**: Azure AD is the primary authentication source. The endpoint assumes `req.user` is populated by Azure AD middleware.
- **A-002**: The `app.Users`, `app.Applications`, and `app.UserApplications` tables exist (EPIC-BQM-001 Database Foundation prerequisite).
- **A-003**: A super-admin user is seeded on initial deployment with `role = administrator` and assignment to all applications (EPIC-BQM-001 seed scripts handle this).
- **A-004**: The application list (Maestro, EYST, Prodigy, Vector, Navigate) is static during MVP. Adding/removing applications is out of scope.
- **A-005**: Exactly one role per user is a hard constraint; the system cannot support a user with multiple roles simultaneously.
- **A-006**: Role changes (e.g., admin → viewer) do not require forceful logout; the change takes effect on the next request.
- **A-007**: All timestamps are recorded server-side (UTC) for consistency and auditability.
- **A-008**: Email is used as a unique secondary identifier for display purposes but `UserId` (Identity key) is the primary key.
- **A-009**: Existing user, role, and application baseline records from the database foundation are available before this feature is used.
- **A-010**: Authentication context is available to determine whether the current user is an administrator.
- **A-011**: User Administration focuses on dashboard-specific access management and does not replace enterprise identity lifecycle systems.
- **A-012**: The initial administrator (super-admin) account exists so administrative workflows can begin without manual database intervention.
- **A-013**: User-facing error messages should be actionable and concise, while avoiding disclosure of sensitive internal details.

---

## Implementation Constraints *(mandatory)*

- **Test-First Development (Constitution Principle IV)**: All functional requirements (FR-001 through FR-030) MUST have corresponding automated test cases written before implementation. Tests MUST run in isolation via Vitest without external databases or Azure AD.

- **Role-Based Access Control (Constitution Principle V)**: Every request MUST verify authentication and authorization. The "exactly one role per user" constraint MUST be enforced at the data layer (unique constraint or application logic).

- **Data Integrity (Constitution Principle I)**: All user/role/application changes MUST be audited with `CreateDate`, `CreatedBy`, `UpdateDate`, `UpdatedBy` columns.

- **Error Handling**: All error responses MUST be non-technical and user-friendly. Internal errors MUST be logged server-side with request ID for debugging.

- **Soft Deletion Only**: No hard deletion of user records. Deactivation via `IsActive = false` is the only supported removal method.

---

## Dependencies

- **EPIC-BQM-001 (Database Foundation)**: Requires `app.Users`, `app.Applications`, `app.UserApplications`, `app.Roles` tables with audit columns.

- **EPIC-BQM-005 (Authentication & Authorization)**: Assumes Azure AD authentication is configured and `req.user` is populated by middleware.

- **EPIC-BQM-010 (CI Pipeline)**: Feature branch MUST pass baseline CI (lint, type-check, tests) before merge to protected trunk.

---

## Specification Status

**Ready for Planning**: This specification is complete, testable, and ready for the `/speckit.clarify` or `/speckit.plan` phases.
