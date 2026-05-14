# Data Model - User Administration & RBAC (EPIC-BQM-002)

> Phase 1 output for `003-user-admin`.  
> All entities below are **already defined** in the database foundation (Epic 001).  
> This document records how they are consumed, constrained, and extended by this feature.

---

## Entities

### app.Users

Represents a dashboard user. Created and managed exclusively through the User Administration
API. No hard delete.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| UserId | UNIQUEIDENTIFIER | PK | Stable identity key; set at creation |
| Username | NVARCHAR(255) | UNIQUE, NOT NULL | Internal identity key / login name |
| Email | NVARCHAR(255) | UNIQUE, NOT NULL | Displayed in user list |
| AzureADObjectId | NVARCHAR(100) | NOT NULL | Populated on first SSO login (Extended-MVP) |
| DisplayName | NVARCHAR(255) | NULL | Shown in UI |
| IsActive | BIT | NOT NULL, DEFAULT 1 | Soft-delete flag; set to 0 on deactivation |
| CreateDate | DATETIME2 | NOT NULL, DEFAULT SYSUTCDATETIME() | Audit |
| CreatedBy | NVARCHAR(255) | NOT NULL | Populated from session user at API layer |
| UpdateDate | DATETIME2 | NOT NULL | Audit — updated on every mutation |
| UpdatedBy | NVARCHAR(255) | NOT NULL | Populated from session user at API layer |

**Business rules**:
- Only core identity fields are required for MVP: `Username`, `Email`, `IsActive`.
- `DisplayName` is optional.
- Deactivating a user sets `IsActive = 0` — record is not removed.
- An administrator cannot be left with no role after updates.

Validation Rules:
- `AzureADObjectId` must be non-empty.
- `Email` must match valid email format and be unique.
- `DisplayName` length 1..255.
- `Role` must be one of allowed enum values.
- `IsActive` is required and defaults to true on create.

State Transitions:
- Active -> Inactive via soft-delete (`IsActive=true` to `false`).
- Inactive -> Active via reactivation (`IsActive=false` to `true`).
- Role change uses replacement semantics with exactly one active role at all times.

---

### app.Applications (reference only — not modified by this feature)

| Column | Type | Notes |
|--------|------|-------|
| ApplicationId | UNIQUEIDENTIFIER | PK |
| ApplicationName | NVARCHAR(255) | |
| ServiceLine | NVARCHAR | |
| SubServiceLine | NVARCHAR | |
| IsActive | BIT | |
| CreateDate | DATETIME2 | |
| CreatedBy | NVARCHAR | |
| UpdateDate | DATETIME2 | |
| UpdatedBy | NVARCHAR | |

Validation Rules:
- `ApplicationId` unique and non-empty.
- `ApplicationName` required.

--- 

### app.Roles

Lookup table seeded with exactly three rows. Not modified at runtime by this feature.

| Column | Type | Notes |
|--------|------|-------|
| RoleId | UNIQUEIDENTIFIER | PK |
| RoleName | NVARCHAR(100) | UNIQUE — `administrator`, `application_owner`, `viewer` |
| Description | NVARCHAR(500) | |
| PermissionLevel | INT | 100 (admin), 50 (owner), 10 (viewer) |
| IsActive | BIT | |

**Business rules**:
- Allowed role names are fixed: `administrator`, `application_owner`, `viewer`.
- No new roles are created by this feature.

---

### app.UserRoles

Represents the effective role assignment for a user. One-to-one with Users enforced by
UNIQUE constraint on `UserId`.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| UserRoleId | UNIQUEIDENTIFIER | PK | |
| UserId | UNIQUEIDENTIFIER | FK → app.Users, UNIQUE | Enforces exactly-one-role rule |
| RoleId | UNIQUEIDENTIFIER | FK → app.Roles | |
| AssignedDate | DATETIME2 | NOT NULL | |
| AssignedBy | NVARCHAR(255) | NOT NULL | |
| CreateDate / CreatedBy / UpdateDate / UpdatedBy | DATETIME2 / NVARCHAR | Audit | |

**Business rules**:
- Role assignment uses `MERGE ON UserId` to replace the existing row atomically.
- The UNIQUE constraint on UserId is the database-level guarantee of the one-role rule.
- A role change becomes effective immediately for the next API request evaluation.

---

### app.UserApplications

Represents per-user application access scope. Many-to-one with Users; unique pair per
user + application.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| UserApplicationId | UNIQUEIDENTIFIER | PK | |
| UserId | UNIQUEIDENTIFIER | FK → app.Users | |
| ApplicationId | UNIQUEIDENTIFIER | FK → app.Applications | |
| AssignedDate | DATETIME2 | NOT NULL | |
| AssignedBy | NVARCHAR(255) | NOT NULL | |
| CreateDate / CreatedBy / UpdateDate / UpdatedBy | DATETIME2 / NVARCHAR | Audit | |
| (implicit) | | UNIQUE(UserId, ApplicationId) | Prevents duplicate assignments |

**Business rules**:
- Assignment uses `MERGE ON (UserId, ApplicationId)` — idempotent.
- "All Applications" shortcut: service iterates `app.Applications WHERE IsActive = 1`
  and merges each row.
- Removing an assignment deletes the row. This is not a soft-delete; the user can be
  re-assigned at any time without data loss.
- Removal takes effect for the next authorization check.

Validation Rules:
- Unique composite key on (`UserId`, `ApplicationId`).
- `ApplicationId='*'` denotes all-applications access and must appear at most once per user.

State Rules:
- If `ApplicationId='*'` exists, explicit app rows may be retained for history but are ignored for authorization.
- Duplicate assignment attempts must be rejected with conflict response.
---


## Entity Relationships

```
app.Users (1) ──── (1) app.UserRoles ──── (N) app.Roles
app.Users (1) ──── (N) app.UserApplications ──── (N) app.Applications
```

---

## State Transitions

### User Lifecycle

```
[Created — IsActive=1]
        │
        ▼ PUT /api/users/:id { isActive: false }
[Deactivated — IsActive=0]
        │
        ▼ PUT /api/users/:id { isActive: true }  (re-activation)
[Active — IsActive=1]
```

### Role Assignment

```
[User created — no role]
        │
        ▼ PUT /api/users/:id/roles { roleId }
[Has Role]
        │
        ▼ PUT /api/users/:id/roles { differentRoleId }  — MERGE replaces
[Has New Role]
```

---

## Validation Rules

| Field | Rule |
|-------|------|
| Username | Required, unique, 1–255 chars, no whitespace-only |
| Email | Required, unique, valid RFC-5322 format, max 255 chars |
| Role | Required on assignment; must be one of three known RoleIds (validated by FK) |
| ApplicationId | Must reference an existing active ApplicationId |
| DisplayName | Optional, max 255 chars |

## Derived Authorization Model

Authorization input for each request:
- Authenticated user identity (`UserId`, `AzureADObjectId`)
- `IsActive`
- Effective `Role`
- Application scopes from `UserApplications`

Authorization checks in order:
1. Authenticated? If no -> 401.
2. Active user? If no -> 403.
3. Role allows action? If no -> 403.
4. Application scope allows target app? If no -> 403.

Special cases:
- `administrator` bypasses application scope checks.
- `viewer` can only perform read operations.
- `application_owner` can modify only assigned applications.
