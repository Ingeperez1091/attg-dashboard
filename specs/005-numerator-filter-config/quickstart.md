# Quickstart: Epic 004 Numerator Filter Configuration

**Updated**: 2026-04-15 — Added application model endpoint, migration/rollback scripts, seed verification, ps_scripts relocation.

## Goal

Implement numerator filter configuration with model-driven field discovery, type-aware operator validation, strict RBAC, atomic updates with audit logging, and database migration/rollback tooling.

## Prerequisites

- Working on the existing branch (no new branch creation).
- Existing user/role/application assignment flow from Epic 002 is available.
- Application catalog is seeded with in-scope applications (5 apps).
- Local environment supports current test runner (`npm test` from repository root).
- `sqlcmd` available for database migration execution.

## Database Setup

### 1. PowerShell scripts location

The database automation scripts live under `scripts/database/`:

```powershell
# From repository root
Get-ChildItem scripts/database
```

### 2. Run forward migrations

Apply migrations 006–009 sequentially:

```powershell
# Using the new migration runner
.\scripts\database\run-migrations.ps1 -ServerInstance "localhost" -Database "DashboardTest"
```

Or manually with sqlcmd:

```powershell
sqlcmd -S localhost -d DashboardTest -i database/migrations/006_create_application_model_fields.sql
sqlcmd -S localhost -d DashboardTest -i database/migrations/007_create_numerator_filter_rules.sql
sqlcmd -S localhost -d DashboardTest -i database/migrations/008_create_rule_change_audit.sql
sqlcmd -S localhost -d DashboardTest -i database/migrations/009_seed_application_model_fields.sql
```

### 3. Verify seed data

```sql
-- Should return 32 total rows across 5 applications
SELECT a.ApplicationName, COUNT(*) AS FieldCount,
      SUM(CAST(am.IsFilterable AS INT)) AS FilterableCount,
       SUM(CAST(am.IsMetricDimension AS INT)) AS MetricDimCount
FROM app.ApplicationModelFields am
JOIN app.Applications a ON a.ApplicationId = am.ApplicationId
WHERE am.IsActive = 1
GROUP BY a.ApplicationName
ORDER BY a.ApplicationName;
```

Expected output:

| ApplicationName | FieldCount | FilterableCount | MetricDimCount |
|-----------------|:----------:|:---------------:|:--------------:|
| EYST | 7 | 4 | 1 |
| Maestro | 5 | 2 | 1 |
| Navigate | 7 | 2 | 1 |
| Prodigy | 7 | 3 | 1 |
| Vector | 6 | 4 | 1 |

### 3a. Verify seed idempotency

Re-run migration `009` and confirm counts remain unchanged:

```powershell
.\scripts\database\run-migrations.ps1 -ServerInstance "localhost" -Database "DashboardTest" -From 9 -To 9
```

Then rerun the seed verification query from step 3. Totals and per-application counts must remain exactly the same (no duplicates).

### 4. Rollback (if needed)

```powershell
# Roll back a specific range (e.g., 009 down to 006)
.\scripts\database\run-rollback.ps1 -ServerInstance "localhost" -Database "DashboardTest" -From 9 -To 6
```

## Implementation Steps

### 1. API Route Placement (Project Structure Alignment)

1. Add numerator model retrieval under the existing applications namespace:
  - `src/frontend/app/api/applications/[appId]/numeratormodel/route.ts` (`GET`)
2. Add numerator filter rule management endpoint:
  - `src/frontend/app/api/filters/numerator/[appId]/route.ts` (`GET`, `PUT`)

### 2. Application and Domain Layer (Plan Alignment)

3. Implement use cases in `src/frontend/core/application/usecases/`:
  - `GetApplicationNumeratorModelUseCase.ts`
  - `GetNumeratorFiltersUseCase.ts`
  - `UpdateNumeratorFiltersUseCase.ts`
4. Add DTOs in `src/frontend/core/application/dto/`:
  - `ApplicationNumeratorModelDTO.ts`
  - `NumeratorFilterDTO.ts`
  - `FilterRuleDTO.ts`
5. Add domain validation objects:
  - `src/frontend/core/domain/valueobjects/FieldOperator.ts`
  - `src/frontend/core/domain/valueobjects/FilterRule.ts`

### 3. Persistence and Validation (Plan + Constitution Alignment)

6. Add repository abstractions and implementations:
  - `src/frontend/core/domain/repositories/INumeratorFilterRepository.ts`
  - `src/frontend/infrastructure/persistence/repositories/NumeratorFilterInMemoryRepository.ts`
  - `src/frontend/infrastructure/persistence/repositories/NumeratorFilterSqlRepository.ts`
7. Add schema validation and authorization middleware:
  - `src/frontend/infrastructure/validation/filterRuleSchemas.ts` (Zod)
  - `src/frontend/infrastructure/middleware/filterAuthorizationMiddleware.ts`
8. Add SQL query module:
  - `src/frontend/infrastructure/persistence/mssql/queries/NumeratorFilters.ts`

### 4. Endpoint Behavior (Constitution-Driven Requirements)

9. `GET /api/applications/:appId/numeratormodel` must:
  - enforce role/assignment scope
  - return model fields ordered by `DisplayOrder`
  - return field metadata needed for type-aware operator selection
10. `GET /api/filters/numerator/:appId` must:
  - enforce role/assignment scope
  - return current rule set with resolved field metadata
11. `PUT /api/filters/numerator/:appId` must:
  - validate every field reference belongs to target application and is filterable
  - validate operator compatibility with field data type
  - soft-delete existing active rules (`IsActive = 0`) and insert new active rules (`IsActive = 1`) atomically (transactional)
  - write audit details (actor, before snapshot, after snapshot, timestamp)

### 5. Tests First (Constitution Principle IV)

12. Add/extend contract tests in:
  - `tests/contract/filters/numerator-filter-config/`
13. Add/extend integration tests in:
  - `tests/integration/filters/numerator-filter-config/`
14. Verify deterministic behavior with in-memory repository in test mode, including:
  - RBAC enforcement (`administrator`, `application_owner`, `viewer`)
  - validation failures preserving previous rule set
  - `FIELD_NOT_FILTERABLE` returns `400` and preserves previous rule set
  - audit capture on accepted changes

Note: the above test folders are part of Epic 005 scope and should be created during implementation if they do not exist yet.

## Validation Flow

1. Authenticate session user.
2. Validate `appId` path parameter (UUID format) and ensure target application is active.
3. Evaluate role and assignment scope for target application.
4. For model endpoint: return all fields where `IsActive = 1`, sorted by `DisplayOrder`; UI disables fields where `isFilterable = false`.
5. For `PUT` filter rules:
  a. Validate each rule's `applicationModelFieldId` → must exist, must be filterable, must belong to same application; non-filterable fields return `400 FIELD_NOT_FILTERABLE`.
   b. Validate operator against the field's `FieldType` (Decision 11 type-operator matrix).
  c. Execute transactional soft-replacement (set previous active rows to `IsActive = 0`, insert new rows with `IsActive = 1`) and audit insert.
6. Return structured responses for success (`200`) and errors (`400/401/403/404/409/500`).

## Local Verification

Run from repository root:

```powershell
npm run lint
npm run typecheck
npm test
```

Run targeted suites:

```powershell
npx vitest run tests/contract/filters/numerator-filter-config tests/integration/filters/numerator-filter-config
```

## Validation Evidence (T046/T047/T063)

The implementation validation run was executed with:

```powershell
npm run test -- tests/contract/filters tests/integration/filters
```

Observed output summary:

- 10 test files passed
- 10 tests passed
- Run duration: 8.92s

Documentation corrections applied during validation:

- Added filter suite discovery patterns in `vitest.config.ts` for `tests/contract/filters/**/*.test.ts` and `tests/integration/filters/**/*.test.ts`.
- Captured run evidence in `tests/integration/filters/numerator-filter-config/README.md`.

Performance evidence format:

1. Execute targeted suite command above.
2. Capture test file count, test count, and total duration.
3. Confirm p95 thresholds in `tests/integration/filters/numerator-filter-config/filter-performance.integration.ts` remain `<= 3000ms` for both GET and PUT handlers.
4. Record command + summary in `tests/integration/filters/numerator-filter-config/README.md`.

## Manual API Check

Use `{appId}` as the application path parameter in all endpoint calls.

### Get application model fields

```http
GET /api/applications/{appId}/numeratormodel
```

Expected `200`:
```json
{
  "applicationId": "10000000-0000-0000-0000-000000000001",
  "applicationName": "Maestro",
  "fields": [
    {
      "applicationModelFieldId": "...",
      "fieldName": "Region",
      "fieldType": "text",
      "isFilterable": true,
      "isMetricDimension": true,
      "displayOrder": 1,
      "allowedOperators": ["EQUALS", "NOT_EQUALS", "CONTAINS", "NOT_CONTAINS", "IN_LIST", "NOT_IN_LIST"]
    }
  ]
}
```

### Retrieve filter rules

```http
GET /api/filters/numerator/{appId}
```

Expected `200`:
```json
{
  "applicationId": "10000000-0000-0000-0000-000000000001",
  "applicationName": "Maestro",
  "rules": [
    {
      "ruleId": "...",
      "applicationModelFieldId": "...",
      "fieldName": "Region",
      "fieldType": "text",
      "operator": "EQUALS",
      "value": "US",
      "ruleOrder": 1
    }
  ],
  "lastUpdatedAt": "2026-04-15T12:00:00Z",
  "lastUpdatedBy": "admin@example.com"
}
```

### Replace filter rules

```http
PUT /api/filters/numerator/{appId}
Content-Type: application/json

{
  "rules": [
    {
      "applicationModelFieldId": "<Region-ApplicationModelFieldId>",
      "operator": "EQUALS",
      "value": "US"
    },
    {
      "applicationModelFieldId": "<Budget-ApplicationModelFieldId>",
      "operator": "GREATER_OR_EQUAL",
      "value": "20000"
    }
  ]
}
```

Expected:
- `200` with updated ordered ruleset (includes resolved `fieldName` and `fieldType`)
- Prior rules unchanged on invalid request
- Accepted update creates exactly one audit entry

## Migration Script Inventory

| Migration | File | Rollback |
|-----------|------|----------|
| 006 | `database/migrations/006_create_application_model_fields.sql` | `database/rollback/rollback_006_create_application_model_fields.sql` |
| 007 | `database/migrations/007_create_numerator_filter_rules.sql` | `database/rollback/rollback_007_create_numerator_filter_rules.sql` |
| 008 | `database/migrations/008_create_rule_change_audit.sql` | `database/rollback/rollback_008_create_rule_change_audit.sql` |
| 009 | `database/migrations/009_seed_application_model_fields.sql` | `database/rollback/rollback_009_seed_application_model_fields.sql` |

## Out of Scope

- Denominator rule configuration UI and APIs
- Numerator payload ingestion and staging behavior
- Downstream pipeline rule execution and metric recalculation
- Expanded boolean expression engine (OR/grouping)
- Application model field CRUD via API (fields are seeded via migration only for MVP)
