# BQM-US030 — Denominator Model Database Schema and Seed Data

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-008 (Denominator Rules Configuration)  
> **Priority**: 1 — Critical | **Phase**: Phase 2

---

### :bust_in_silhouette: User Story

**As a** data engineer  
**I want to** have the denominator model metadata tables (`DenominatorModels`, `DenominatorFilterRules`, `AdoptionSettings`) created and seeded in Azure SQL  
**So that** the configuration UI, API, and ADF pipeline can reference denominator column definitions with referential integrity.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** the migration scripts are executed, **When** I query `app.DenominatorModels`, **Then** I find ~17 rows representing the Mercury view columns with correct FieldName, FieldType, SourceColumn, IsFiltirable, and DisplayOrder values.
- **Given** `app.DenominatorFilterRules` exists, **When** I insert a rule referencing a valid `DenominatorModelId` and `ApplicationId`, **Then** the FK constraints are satisfied and the row is persisted.
- **Given** I try to insert a `DenominatorFilterRules` row referencing a non-existent `DenominatorModelId`, **When** the INSERT executes, **Then** a FK violation error is raised.
- **Given** `app.DenominatorFilterRules` has a UNIQUE constraint on (`ApplicationId`, `DenominatorModelId`, `Operator`, `Value`), **When** I try to insert a duplicate rule, **Then** a constraint violation is raised.
- **Given** `app.AdoptionSettings` exists, **When** I insert settings for an application, **Then** the UNIQUE constraint on `ApplicationId` ensures one settings row per app.
- **Given** the `app.RuleChangeAudit` table already exists, **When** the ChangeScope migration runs, **Then** a `ChangeScope NVARCHAR(32)` column is added with a default of 'Numerator' for existing rows.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK109] Create DDL migration: `app.DenominatorModels` — PK (DenominatorModelId UNIQUEIDENTIFIER DEFAULT NEWID()), FieldName NVARCHAR(128), FieldType NVARCHAR(32) CHECK(FieldType IN ('string','number','date')), SourceColumn NVARCHAR(256), IsFiltirable BIT DEFAULT 1, DisplayOrder INT, IsActive BIT DEFAULT 1, CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(), UpdatedAt DATETIME2 DEFAULT SYSUTCDATETIME(); UNIQUE(FieldName)
- [ ] [BQM-TK110] Create DDL migration: `app.DenominatorFilterRules` — PK (RuleId UNIQUEIDENTIFIER DEFAULT NEWID()), ApplicationId UNIQUEIDENTIFIER FK→Applications, DenominatorModelId UNIQUEIDENTIFIER FK→DenominatorModels, Operator NVARCHAR(32) CHECK(Operator IN ('EQ','NEQ','GT','GTE','LT','LTE','IN','NOT_IN','CONTAINS','NOT_CONTAINS')), Value NVARCHAR(512), SortOrder INT DEFAULT 0, IsActive BIT DEFAULT 1, CreatedAt/UpdatedAt audit columns; UNIQUE(ApplicationId, DenominatorModelId, Operator, Value)
- [ ] [BQM-TK111] Create DDL migration: `app.AdoptionSettings` — PK (SettingId UNIQUEIDENTIFIER DEFAULT NEWID()), ApplicationId UNIQUEIDENTIFIER FK→Applications UNIQUE, AdoptionLevel NVARCHAR(32) CHECK(AdoptionLevel IN ('Engagement','Client')), RevenueMetric NVARCHAR(64), NumeratorSource NVARCHAR(32) CHECK(NumeratorSource IN ('API','Manual')), CreatedAt/UpdatedAt
- [ ] [BQM-TK112] Create migration: Add `ChangeScope NVARCHAR(32) DEFAULT 'Numerator'` column to `app.RuleChangeAudit`; backfill existing rows with 'Numerator'
- [ ] [BQM-TK113] Create seed script: Insert ~17 `DenominatorModels` rows for Mercury view columns (EngagementID, Engagement, ClientID, Client, AccountChannel, EngagementSubServiceLine, EngagementServiceCode, EngagementService, EngagementStatus, CreationDate, ReleaseDate, ETD_ANSRAmt, FYTD_ANSRAmt, ETD_TERAmt, FYTD_TERAmt, ETD_ChargedHours, FYTD_ChargedHours)
- [ ] [BQM-TK114] Create seed script: Insert `AdoptionSettings` rows for 5 applications (Maestro: Engagement/ETD_ANSRAmt/Manual, EYST: Client/ETD_ANSRAmt/Manual→API, Prodigy: Client/ETD_ANSRAmt/Auto, Vector: Engagement/ETD_ANSRAmt/Manual→API, Navigate: Engagement/ETD_ANSRAmt/Manual→API)
- [ ] [BQM-TK115] Write migration verification tests — validate table existence, FK constraints, seed data counts

### :link: Links

- **Epic:** EPIC-BQM-008 (`Documentation/Backlog/epics/epic-008-denominator-rules-config.md`)
- **Architecture:** `Documentation/ProjectSpecifications/architecture.md` v1.1.0 — DenominatorModels table structure, DenominatorFilterRules table structure, AdoptionSettings table, Mercury View Column Definitions seed data
- **Assumptions:** `Documentation/ProjectSpecifications/assumptions.md` — A1 (Mercury format stable), A12 (Shared Denominator Model), A13 (Denominator Filter Rules AND-Combined)
- **Depends on:** EPIC-BQM-001 (Database Foundation — `app` schema and `Applications` table must exist)
- **Blocks:** US027 (Config UI), US028 (Preview), US029 (Audit)
- **PRD:** `StakeholderDocuments/AUTOMATED_SOLUTION_ARCHITECTURE.md` — Mercury view column names; `StakeholderDocuments/BUSINESS_RULES_AND_ETL_SUMMARY.md` — per-app adoption settings
- **Constitution:** Principle I — SQL-first schema; Principle II — configuration-driven business rules
- **Sprint:** (Assign via Milestone)

### Business Rules

- `DenominatorModels` is seeded once and shared (no `ApplicationId`). The Mercury view schema is identical for all 5 applications (Assumption A12).
- `IsFiltirable = 0` for ID fields (EngagementID, ClientID) and display-only fields (EngagementService, ETD_ChargedHours, FYTD_ChargedHours) — these cannot be used as filter criteria.
- `SourceColumn` contains the exact Mercury view column name in brackets (e.g., `[EngagementServiceCode]`) to enable safe dynamic SQL generation.
- All DDL follows the existing pattern from `database/schema/app/ApplicationModels.sql` and `database/schema/app/NumeratorFilterRules.sql`.

### Data Impact & Pipelines

- **Creates:** `app.DenominatorModels` (17 rows), `app.DenominatorFilterRules` (empty, populated by UI), `app.AdoptionSettings` (5 rows, one per app).
- **Modifies:** `app.RuleChangeAudit` (adds ChangeScope column).
- **Consumed by:** All other US in EPIC-008 (UI, API, preview, audit); ADF Metrics Processing pipeline (reads DenominatorModels for column mapping, reads DenominatorFilterRules for per-app filters, reads AdoptionSettings for match key and revenue metric).
