# Quickstart: Database Foundation - Schema Setup & Seed Data

## Purpose

This guide describes how to validate the database foundation design and prepare for implementation of the schema, seed data, and external Mercury denominator connectivity checks.

## Prerequisites

- Azure SQL target database available for local or shared development
- Access to the repository-standard `database/` structure
- Mercury-provided credentials or connection details for the external denominator database
- Permission to run deployment scripts and validation queries

## Planned Asset Locations

- Local schema scripts: `database/schema/dbo/` and `database/schema/stage/`
- Seed scripts: `database/seed/`
- External connectivity validation: `database/views/` or deployment validation scripts
- Automated checks: `tests/contract/` and `tests/integration/`

## Validation Flow

1. Run automated setup:

```powershell
.\scripts\database\setup-database.ps1 -Server ".\SQLEXPRESS" -Database "ATTG_Usage" -UseTrustedConnection
```

2. Verify audit columns exist on all mutable local tables and use UTC database defaults/update behavior.
3. Re-run setup or seed scripts to verify idempotency.
4. Validate that exactly one role exists per user and that the super-admin is assigned all applications.
5. Use Mercury-provided credentials to run external-view contract/integration checks.
6. Record connectivity gaps as deployment blockers before downstream implementation.

## Suggested Validation Queries

### Local object verification

```sql
SELECT TABLE_SCHEMA, TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA IN ('app', 'stage')
ORDER BY TABLE_SCHEMA, TABLE_NAME;
```

### Audit column verification

```sql
SELECT TABLE_NAME, COLUMN_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'app'
  AND COLUMN_NAME IN ('CreateDate', 'CreatedBy', 'UpdateDate', 'UpdatedBy')
ORDER BY TABLE_NAME, COLUMN_NAME;
```

### Seed verification

```sql
SELECT COUNT(*) AS ApplicationCount FROM app.Applications;
SELECT COUNT(*) AS RoleCount FROM app.Roles;
SELECT COUNT(*) AS UserCount FROM app.Users;
```

### External denominator access verification

```sql
SELECT TOP (10) *
FROM vw_USTaxBTS_FY26_MaxACD;
```

### External denominator required-column projection

```sql
SELECT TOP (0)
  [AccountingCycleDate], [EngagementID], [Engagement], [ClientID], [Client],
  [AccountChannel], [EngagementSubServiceLine], [EngagementServiceCode], [EngagementService],
  [EngagementStatus], [CreationDate], [ReleaseDate], [ETD_ANSRAmt], [FYTD_ANSRAmt],
  [ETD_TERAmt], [FYTD_TERAmt], [ETD_ChargedHours], [FYTD_ChargedHours]
FROM vw_USTaxBTS_FY26_MaxACD;
```

## Expected Outcomes

- Local schema objects exist in the planned locations and database schemas
- Seed scripts can be rerun without creating duplicates
- Super-admin access model is established
- External denominator view access is confirmed or clearly blocked with actionable connection information

## Implementation Handoff

After these checks are defined and accepted, generate tasks with `/speckit.tasks` and implement the scripts in the repository paths documented above.