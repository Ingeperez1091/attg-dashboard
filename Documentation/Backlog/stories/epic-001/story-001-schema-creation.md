# BQM-US001 - Database Schema Creation

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-001 (Database Foundation & Seed Data)  
> **Priority**: 1 — Critical | **Phase**: MVP

---

### :bust_in_silhouette: User Story

**As a** data engineer  
**I want to** have a complete Azure SQL database schema with all core tables and audit columns  
**So that** all application data (users, roles, filters, metrics, staging) has a properly structured persistence layer.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** the database is provisioned, **When** migration scripts run, **Then** the following tables exist in `app` schema: Applications, Roles, Users, UserApplications, UserRoles, DenominatorFilterRules, NumeratorFilterRules, MetricSnapshots.
- **Given** a clean machine, **When** `scripts/database/setup-database.ps1` is executed, **Then** SQL CLI tooling and required services are validated and schema deployment runs end-to-end.
- **Given** any table is created, **When** its schema is inspected, **Then** it includes `CreateDate`, `CreatedBy`, `UpdateDate`, `UpdatedBy` audit columns.
- **Given** the `stage` schema, **When** migration scripts run, **Then** `stage.EngagementUsageRaw` exists with columns: StageId, ApplicationId, PayloadJson, CreateDate, CreatedBy.
- **Given** the schema is applied, **When** data type constraints are checked, **Then** they align with PRD coercion rules (numeric IDs, datetime for dates, nvarchar for strings).
- **Given** the `app.Applications` is created, **When** its schema is inspected, **Then** it includes the following required columns: ServiceLine, SubServiceLine, ApplicationName, IsActive

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK001] Write DDL for `app.Applications` table
- [ ] [BQM-TK002] Write DDL for `app.Roles` table
- [ ] [BQM-TK003] Write DDL for `app.Users` table
- [ ] [BQM-TK004] Write DDL for `app.UserApplications` (unique constraint on UserId+ApplicationId)
- [ ] [BQM-TK005] Write DDL for `app.UserRoles` (unique constraint on UserId+RoleId)
- [ ] [BQM-TK006] Write DDL for `app.DenominatorFilterRules` table
- [ ] [BQM-TK007] Write DDL for `app.NumeratorFilterRules` table
- [ ] [BQM-TK008] Write DDL for `app.MetricSnapshots` table
- [ ] [BQM-TK009] Write DDL for `stage.EngagementUsageRaw` table
- [ ] [BQM-TK009] Write DDL for `app.ApplicationUsage` table
- [ ] [BQM-TK010] Write unit tests for migration scripts
- [ ] [BQM-TK011] Add PowerShell setup entrypoint (`scripts/database/setup-database.ps1`) to run schema deployment

### :link: Links

- **Epic:** EPIC-BQM-001 (`Documentation/Backlog/epics/epic-001-database-foundation.md`)
- **Architecture:** `Documentation/ProjectSpecifications/architecture.md` — Section 4.3
- **PRD:** `StakeholderDocuments/BUSINESS_RULES_AND_ETL_SUMMARY.md` — Required Columns, Data Type Coercion
- **Sprint:** (Assign via Milestone)

### Non-Functional Requirements

- Migration scripts must be idempotent and versioned.
- Schema changes must not break existing data if re-run.

### Business Rules

- All tables carry audit columns per Constitution Principle I.
- Data type coercion follows documented rules: numeric IDs use `errors='coerce'` semantics (NULL on failure, not silent discard).

### Data Impact & Pipelines

- Creates the entire persistence layer; no pipeline impact until data is loaded.


<!--
GitHub-Issue-Number: 
GitHub-Issue-URL: 
-->

<!--
AzureDevOps-WorkItem-Id: 0
AzureDevOps-WorkItem-Url: https://dev.azure.com/eygs3/attg-analytics-dashboard/_workitems/edit/0
-->
