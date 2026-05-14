# Data Model: EPIC-BQM-005 Authentication and Authorization

**Feature Branch**: `011-authentication-authorization`  
**Date**: 2026-05-08  
**Spec**: `spec.md`

## 1. Security-Relevant Entities

### 1.1 User

Represents a platform user account eligible for authentication and authorization evaluation.

| Attribute | Type | Description |
|-----------|------|-------------|
| `userId` | UUID | Stable identity key used across session and audit records |
| `username` | string | Unique username/identity key |
| `email` | string | Unique user email |
| `displayName` | string | Human-readable name |
| `isActive` | boolean | Active-status gate for protected operations |

**Validation rules**:
- `userId`, `username`, and `email` must be unique.
- Inactive users cannot perform protected operations.

---

### 1.2 Role Assignment

Represents the single role linked to a user for authorization decisions.

| Attribute | Type | Description |
|-----------|------|-------------|
| `userId` | UUID | FK to User |
| `roleName` | enum | One of `administrator`, `application_owner`, `viewer` |
| `assignedDate` | datetime | Audit timestamp |
| `assignedBy` | string | Audit actor |

**Validation rules**:
- Exactly one active role assignment per user.
- Role value must belong to canonical 3-role set.

---

### 1.3 User Application Scope

Represents per-user application permissions for non-admin data visibility and actions.

| Attribute | Type | Description |
|-----------|------|-------------|
| `userId` | UUID | FK to User |
| `applicationId` | UUID | FK to Application |
| `assignedDate` | datetime | Assignment timestamp |
| `assignedBy` | string | Assignment actor |

**Validation rules**:
- Duplicate `(userId, applicationId)` links are prohibited.
- Non-admin users require scope membership for app-scoped access.
- `administrator` bypasses per-application scope checks.

---

### 1.4 Session Principal

Represents runtime authenticated context used by route/service authorization checks.

| Attribute | Type | Description |
|-----------|------|-------------|
| `userId` | UUID | Principal identity |
| `role` | enum | Effective role |
| `isActive` | boolean | Active flag from user profile |
| `applications` | string[] | Assigned application IDs or wildcard `*` |

**Validation rules**:
- Missing principal => unauthenticated flow.
- Inactive principal => forbidden flow.
- Scope must be present for non-admin app-scoped operations.

---

### 1.5 Authorization Decision

Represents normalized allow/deny outcome for protected routes and endpoints.

| Attribute | Type | Description |
|-----------|------|-------------|
| `status` | number | `200` allow, `401` unauthenticated, `403` unauthorized |
| `reasonCode` | string | Canonical reason category (e.g., `UNAUTHORIZED`, `FORBIDDEN`) |
| `redirectTo` | string? | Optional route redirect for protected UI navigation |

**Validation rules**:
- `401` returned only when no valid authenticated principal exists.
- `403` returned for authenticated principals lacking role/scope/active status.
- Error payloads must not include internal implementation details.

## 2. Relationships

- User `1 -> 1` Role Assignment (single active role).
- User `1 -> N` User Application Scope links.
- Session Principal derived from User + Role Assignment + Scope.
- Authorization Decision produced from Session Principal + requested route/action/resource.

## 3. State Transitions

### 3.1 Session/Auth Lifecycle

`Unauthenticated -> Authenticated -> Expired/Invalid`

- `Unauthenticated -> Authenticated`: valid sign-in/session resolution.
- `Authenticated -> Expired/Invalid`: token/session expiration or invalid context.

### 3.2 Access Decision Lifecycle

`Request Received -> Principal Resolution -> Role/Scope Evaluation -> Decision`

- No principal: decision = `401`.
- Principal inactive or insufficient permissions: decision = `403`.
- Principal authorized: decision = allow (`200` route/API progression).

## 4. Data Integrity and Audit Notes

- Existing audit columns (`CreateDate`, `CreatedBy`, `UpdateDate`, `UpdatedBy`) remain mandatory for persisted user/role/scope records.
- Initial super-admin provisioning remains seed-script-driven and must exist in every fresh environment.
- Authorization checks are server-side authoritative; UI state is advisory only.
