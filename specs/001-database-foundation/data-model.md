# Data Model: Database Foundation - Schema Setup & Seed Data

## Scope

This model covers the local Azure SQL entities required for application metadata, users, role assignment, user-to-application scope, and raw numerator staging. The Mercury denominator view remains external and is documented here as a dependency boundary, not as a locally created object.

## Local Schemas

- `app`: application runtime data
- `stage`: raw ingestion staging

## Entity: Applications

**Purpose**: Represents each in-scope application tracked by the dashboard.

**Key fields**:
- `ApplicationId` — `UNIQUEIDENTIFIER`, primary key
- `ApplicationName` — unique, required
- `AdoptionLevel` — required, `Engagement` or `Client`
- `MatchKey` — required, `engagement_id` or `client_id`
- `ServiceLine` — required
- `SubServiceLine` — required
- `Description` — nullable
- `IsActive` — required
- `CreateDate`, `CreatedBy`, `UpdateDate`, `UpdatedBy`

**Validation rules**:
- `ApplicationName` must be unique
- `AdoptionLevel` limited to supported values
- `MatchKey` must align with application adoption logic

## Entity: Roles

**Purpose**: Stores the three allowed application roles.

**Key fields**:
- `RoleId` — `UNIQUEIDENTIFIER`, primary key
- `RoleName` — unique, one of `administrator`, `application_owner`, `viewer`
- `Description`
- `PermissionLevel` — numeric or ordered textual value for deterministic authorization logic
- `CreateDate`, `CreatedBy`, `UpdateDate`, `UpdatedBy`

**Validation rules**:
- Only the three constitution-approved roles may be seeded
- `RoleName` must be unique

## Entity: Users

**Purpose**: Stores application users and Azure AD-linked identity metadata.

**Key fields**:
- `UserId` — `UNIQUEIDENTIFIER`, primary key
- `Username` — unique, required
- `Email` — unique, required
- `AzureADObjectId` — nullable until identity mapping is available
- `DisplayName` — recommended
- `IsActive` — required
- `CreateDate`, `CreatedBy`, `UpdateDate`, `UpdatedBy`

**Validation rules**:
- `Email` unique
- inactive users are soft-deleted, not removed

## Entity: UserRoles

**Purpose**: Auditable assignment of exactly one active role to each user.

**Key fields**:
- `UserRoleId` — `UNIQUEIDENTIFIER`, primary key
- `UserId` — foreign key to `Users`
- `RoleId` — foreign key to `Roles`
- `AssignedDate`
- `AssignedBy`
- `CreateDate`, `CreatedBy`, `UpdateDate`, `UpdatedBy`

**Validation rules**:
- one active role per user enforced by unique constraint on `UserId`
- referenced user and role must exist

## Entity: UserApplications

**Purpose**: Defines which applications a user can access.

**Key fields**:
- `UserApplicationId` — `UNIQUEIDENTIFIER`, primary key
- `UserId` — foreign key to `Users`
- `ApplicationId` — foreign key to `Applications`
- `AssignedDate`
- `AssignedBy`
- `CreateDate`, `CreatedBy`, `UpdateDate`, `UpdatedBy`

**Validation rules**:
- unique composite assignment on `UserId + ApplicationId`
- administrators may be assigned all applications through seed data

## Entity: EngagementUsageRaw

**Purpose**: Stores raw numerator payloads exactly as received before validation or transformation.

**Key fields**:
- `StageId` — `UNIQUEIDENTIFIER`, primary key
- `ApplicationId` — foreign key to `Applications`
- `PayloadJson` — `NVARCHAR(MAX)`, required
- `CreateDate`
- `CreatedBy`

**Validation rules**:
- payload must not be truncated
- records are append-only
- no `UpdateDate`/`UpdatedBy` required for immutable staging rows

## Audit Timestamp Standard

- Mutable local tables use UTC audit defaults and update behavior managed at the database layer for deterministic migration/seed behavior.
- Application services may pass user identity for `CreatedBy`/`UpdatedBy`, but UTC timestamp source remains SQL server UTC.

## External Dependency: Mercury Denominator View

**Object**: `vw_USTaxBTS_FY26_MaxACD`

**Ownership**: Mercury-managed external database

**Consumed fields expected by this feature and downstream epics**:
- `EngagementId`
- `ClientId`
- `ClientName`
- `ServiceCode`
- `ReleaseDate`
- `EngagementStatus`
- `RevenueETD`
- `RevenueYTD`

**Design note**: This feature validates access to the external object and does not create or mirror it locally.

## Relationships

- `Users 1 -> 1 UserRoles`
- `Roles 1 -> many UserRoles`
- `Users 1 -> many UserApplications`
- `Applications 1 -> many UserApplications`
- `Applications 1 -> many EngagementUsageRaw`

## State Transitions

### User
- Active -> Inactive via soft delete
- Inactive -> Active via administrative reactivation

### Application
- Active -> Inactive when disabled for future use
- Inactive -> Active when restored

### EngagementUsageRaw
- Received -> Stored in staging
- Stored -> Validated in later epics
- Stored -> Rejected with surfaced validation errors in later epics