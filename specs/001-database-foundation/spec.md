# Feature Specification: Database Foundation - Schema Setup & Seed Data

**Feature Branch**: `001-database-foundation`  
**Created**: 2026-04-14  
**Status**: Ready  
**Input**: User description: "epic-001-database foundation - establish Azure SQL database schema, staging tables, views, and seed data"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create Core Application & Role Schema (Priority: P1)

As a **database administrator**, I need to set up the foundational database schema with core tables for applications, roles, users, and user-application mappings, so that the system can manage user access and application configurations.

**Why this priority**: This is the absolute foundation—without these tables, the system cannot track users, their roles, assigned applications, or any configuration. This blocks all other epics.

**Independent Test**: Can be fully tested by querying the `app` schema to verify all tables exist with correct columns, constraints, and audit columns (CreateDate, CreatedBy, UpdateDate, UpdatedBy on every table).

**Acceptance Scenarios**:

1. **Given** no database exists, **When** migration scripts are executed, **Then** the following tables are created in `app` schema: `Applications`, `Roles`, `Users`, `UserApplications`, `UserRoles` with correct column definitions and constraints.

2. **Given** tables are created, **When** a row is inserted into any `app` schema table, **Then** audit columns (CreateDate, CreatedBy, UpdateDate, UpdatedBy) are automatically populated.

3. **Given** tables exist, **When** querying table structure, **Then** all required columns are present with correct data types (Id GUID PRIMARY KEY, Name NVARCHAR(255), CreatedBy NVARCHAR(255), CreateDate DATETIME2, etc.).

---

### User Story 2 - Create Staging Schema for Raw Numerator Ingestion (Priority: P1)

As a **data engineer**, I need a staging table (`stage.EngagementUsageRaw`) to capture raw numerator payloads before any processing or transformation, so that data integrity is preserved and all ingestions are auditable.

**Why this priority**: The staging table is critical for compliance with Constitution Principle I (Data Integrity First). Raw data must be preserved before any transformation or filtering.

**Independent Test**: Can be fully tested by inserting test JSON payloads into the staging table and verifying they are persisted exactly as received with proper audit metadata (ApplicationId, PayloadJson, CreateDate, CreatedBy).

**Acceptance Scenarios**:

1. **Given** the staging schema exists, **When** a JSON numerator payload is ingested via the API, **Then** it is stored in `stage.EngagementUsageRaw` with fields: StageId (PK), ApplicationId (FK), PayloadJson (RAW JSON), CreateDate, CreatedBy, and the original payload is unchanged.

2. **Given** multiple payloads are ingested, **When** querying the staging table, **Then** each row can be traced to a specific application and ingestion time with the exact payload received.

3. **Given** a staging record exists, **When** querying for records by ApplicationId or date range, **Then** filtering works correctly and returns expected records.

---

### User Story 3 - Create Denominator SQL View for Metric Calculation (Priority: P1)

As a **metrics analyst**, I need a queryable SQL view (`vw_USTaxBTS_FY26_MaxACD`) that represents the addressable population for each application, so that adoption metrics can be calculated accurately. It must be provided by Mercury team in an external database.

**Why this priority**: The denominator is essential for adoption % calculations. Without it, no meaningful metrics can be derived. This view is the single source of truth for what counts toward adoption rates.

**Independent Test**: Can be fully tested by querying the view and verifying it returns engagement records with all required columns (Engagement ID, Client ID, Service Code, Release Date, Engagement Status, Revenue, Application eligibility flags) pre-filtered to represent the addressable population.

**Acceptance Scenarios**:

1. **Given** the denominator view exists and Mercury engagement data is loaded, **When** querying `vw_USTaxBTS_FY26_MaxACD`, **Then** results include only engagements matching base denominator criteria (correct service codes, status, date ranges for each application).

2. **Given** the view is queried, **When** filtering by Application (Maestro, EYST, Vector, Navigate, Prodigy), **Then** only engagements relevant to that application's denominator rules are returned.

3. **Given** the view includes revenue columns, **When** summing revenue from the view, **Then** totals match the pre-calculated addressable revenue for metric calculations.

---

### User Story 4 - Seed Initial Applications, Roles, and Super-Admin User (Priority: P1)

As a **system administrator**, I need seed scripts that populate the database with the 5 in-scope applications (Maestro, EYST, Prodigy, Vector, Navigate), the 3 role types (administrator, application_owner, viewer), and a super-admin user with full access, so that the system is ready for configuration and testing.

**Why this priority**: Without seed data, the system has no applications to measure, no role definitions for access control, and no admin user to bootstrap access. This unblocks user administration and filtering configuration.

**Independent Test**: Can be fully tested by querying the seeded tables and verifying: (a) all 5 applications exist with correct metadata (adoption level, numerator source, match key), (b) all 3 roles exist with correct names, (c) super-admin user exists with correct role assignments and access to all applications.

**Acceptance Scenarios**:

1. **Given** seed scripts are executed, **When** querying the `Applications` table, **Then** all 5 applications are present:
   - Maestro (AdoptionLevel: Engagement)
   - EYST (AdoptionLevel: Client)
   - Prodigy (AdoptionLevel: Client)
   - Vector (AdoptionLevel: Engagement)
   - Navigate (AdoptionLevel: Engagement)

2. **Given** seed scripts are executed, **When** querying the `Roles` table, **Then** all 3 roles exist: `administrator`, `application_owner`, `viewer` with correct permission descriptions.

3. **Given** seed scripts are executed, **When** querying for the super-admin user and their role/application assignments, **Then** the user exists with `administrator` role assigned to all 5 applications.

4. **Given** seed scripts are idempotent, **When** executed multiple times, **Then** no duplicate records are created and the final state is consistent.

---

### Edge Cases

- What happens when seed scripts are run on a fresh database vs. a database that already has data? (Idempotency)
- How does the system handle null or missing audit columns if they aren't auto-populated? (Validation/constraint enforcement)
- What if a migration script fails partway through? (Transaction rollback, script resumability)
- How are character encodings handled in PayloadJson column for non-ASCII characters? (UTF-8 support)
- What happens if the CreateDate is in the future due to clock skew? (Timestamp validation)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST create all core tables in the `app` schema with correct column definitions and primary/foreign key constraints.

- **FR-002**: System MUST create a staging schema with `stage.EngagementUsageRaw` table capable of storing JSON payloads up to 1 MB in size without modification or truncation.

- **FR-003**: System MUST be able to query a SQL view `vw_USTaxBTS_FY26_MaxACD` that returns the engagement list and all records eligible for each application's denominator calculations. It is stored in an external database, it's not required to be created.

- **FR-004**: All tables MUST include audit columns: `CreateDate` (DATETIME2), `CreatedBy` (NVARCHAR(255)), `UpdateDate` (DATETIME2), `UpdatedBy` (NVARCHAR(255)) on every row.

- **FR-005**: System MUST enforce that `CreateDate` and `UpdateDate` are automatically populated with server UTC time on INSERT and UPDATE operations. The dates should be generated in the application, not in the databsae server

- **FR-006**: System MUST seed the database with 5 applications (Maestro, EYST, Prodigy, Vector, Navigate) with correct metadata (AdoptionLevel, MatchKey).

- **FR-007**: System MUST seed the database with 3 roles (administrator, application_owner, viewer) with descriptions of their access levels.

- **FR-008**: System MUST seed a super-admin user with `administrator` role assigned to all 5 applications.

- **FR-009**: System MUST support idempotent seed scripts—running them multiple times produces the same result without duplicates.

- **FR-010**: System MUST support data type coercion rules as documented in `BUSINESS_RULES_AND_ETL_SUMMARY.md` (numeric, string, datetime conversions with errors='coerce' semantics).

- **FR-011**: System MUST preserve audit trails for all seed data changes, including which user created/modified records and when.

- **FR-012**: System MUST provide a PowerShell setup workflow that installs SQL CLI tooling if missing, starts SQL services, verifies SQL Browser state, connects to the target instance, creates the database when missing, executes all migration/seed/validation scripts, and saves a SQL project snapshot.

### Key Entities *(include if feature involves data)*

- **Application**: Represents an EY application being tracked (Maestro, EYST, Prodigy, Vector, Navigate). Attributes: ApplicationId (PK), ApplicationName, AdoptionLevel (Engagement|Client), MatchKey (engagement ID or client ID), Description, ServiceLine, SubServiceLine, IsActive, CreatedBy, CreateDate, UpdatedBy, UpdateDate.

- **Role**: Represents a user role with access level. Attributes: RoleId (PK), RoleName (administrator|application_owner|viewer), Description, PermissionLevel, CreatedBy, CreateDate, UpdatedBy, UpdateDate.

- **User**: Represents a system user. Attributes: UserId (PK), Username, Email, AzureADObjectId, IsActive, CreatedBy, CreateDate, UpdatedBy, UpdateDate.

- **UserRole**: Junction table linking users to roles. Attributes: UserRoleId (PK), UserId (FK), RoleId (FK), AssignedDate, AssignedBy, CreatedBy, CreateDate, UpdatedBy, UpdateDate.

- **UserApplication**: Junction table linking users to applications. Attributes: UserApplicationId (PK), UserId (FK), ApplicationId (FK), AssignedDate, AssignedBy, CreatedBy, CreateDate, UpdatedBy, UpdateDate.

- **EngagementUsageRaw** (Staging): Captures raw numerator payloads as received. Attributes: StageId (PK), ApplicationId (FK), PayloadJson (NVARCHAR(MAX)), CreatedBy, CreateDate. No UpdateDate/UpdatedBy (immutable staging records).

- **vw_USTaxBTS_FY26_MaxACD** (View): Queryable representation of addressable population. Columns: EngagementId, ClientId, ClientName, ServiceCode, ReleaseDate, EngagementStatus, RevenueETD, RevenueYTD, ApplicationId, ApplicationName. It is provided for an external database, so we just need to validate access to that view using credentials provided by Mercury team.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All database objects (tables, views, constraints, indexes) are created without errors on a clean Azure SQL database.

- **SC-002**: Seed scripts execute idempotently—running twice produces identical data state with zero duplicate rows.

- **SC-003**: Audit columns are automatically populated on every INSERT and UPDATE operation across all tables.

- **SC-004**: The denominator view returns results for all 5 applications with correct filtering applied (no hardcoded sample data, real business rules applied).

- **SC-005**: Super-admin user can be queried with `administrator` role and full access to all 5 applications via UserRole and UserApplication tables.

- **SC-006**: Raw staging data is persisted exactly as received—JSON payloads remain unchanged before processing.

- **SC-007**: Migration scripts support repeatable deployment—can be versioned and re-executed safely (idempotent DDL).

- **SC-008**: All constraints (primary keys, foreign keys, not null) prevent invalid data from being inserted.

## Assumptions

- **Data Storage**: Azure SQL Database in Azure Cloud (not on-premises SQL Server).

- **Deployment Method**: T-SQL migration scripts executed via Azure DevOps or similar CI/CD pipeline.

- **Authentication**: Azure AD integration available for capturing CreatedBy/UpdatedBy (using AAD object IDs or UPNs).

- **Data Volume**: Initial data volume is small (< 100K rows in stage tables); no sharding or partitioning required for MVP.

- **Time Zone**: All timestamps use UTC. No local time zone conversions required at database layer.

- **Numerator Source Data Format**: JSON payloads from numerator systems are well-formed and use consistent structure (not validated at database schema level; validation happens in application layer).

- **Denominator Data**: Mercury engagement data will be loaded into `app` schema before denominator view queries. Views assume all required columns exist in source tables.

- **Audit Trail**: CreatedBy will be system user (e.g., "System", "Administrator") for seed data; application user identities tracked after seed.

- **Scope Exclusions**: User permission enforcement at application/repository layer, not database layer (database does not implement row-level security for MVP).

- **Constitution Compliance**: All design decisions follow the Constitution principles, specifically Principle I (Data Integrity First) and Principle II (Configuration-Driven Business Rules).
