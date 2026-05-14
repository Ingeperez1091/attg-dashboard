# Quickstart: Validation Processing Pipeline (EPIC-BQM-006)
**Feature Branch**: `007-validation-processing-pipeline`  
**Date**: 2026-04-16


## Purpose

Implement and verify the validation processing workflow for one application per run, with orchestrated fan-out across active applications.

## Prerequisites

- Database foundation and ingestion path available (EPIC-BQM-001, EPIC-BQM-003).
- Numerator and denominator rule configuration features available (EPIC-BQM-004, EPIC-BQM-008).
- Local denominator snapshot refresh process available (`PL_DenomLoad_Weekly`).
- CI baseline active on protected branches.

## Implementation Sequence

1. Implement domain and application contracts
- Add/confirm `PipelineRun`, `ValidationResult`, `MatchedRecord` domain entities.
- Define repository contract for pipeline run/validation/matching persistence.

2. Implement processing orchestration service
- Add application service for one-application processing lifecycle.
- Add orchestration service for active-application fan-out behavior.

3. Implement persistence adapters
- Add database repository with parameterized SQL queries.
- Add deterministic in-memory repository behavior for tests.
- Preserve clean runtime repository selection in `infrastructure/persistence/runtime`.

4. Implement API adapters
- Add thin trigger/status/result route handlers.
- Enforce role and application access checks in adapter/service boundary.

5. Integrate ADF processing hooks
- Ensure one-application run invocation contract is met.
- Ensure orchestrator can dispatch independent per-application runs.

## Verification Sequence

1. Contract tests
- Trigger run endpoint behavior (`201`, `400`, `401`, `403`, `404`, `409`).
- Status endpoint behavior and visibility constraints.
- Validation results endpoint summary/detail shape and scope enforcement.

2. Integration tests
- Mixed record batch: valid + invalid + duplicate + unmatched + filtered-out outcomes.
- Rule snapshot consistency for run-start state.
- One failed application run does not block remaining orchestrated runs.

3. Data integrity checks
- Staging immutability confirmed.
- Run metadata and counts persisted.
- Validation results include explicit reason context.
- Matched outcomes linked to `PipelineRun` and `ApplicationId`.

4. Performance and async checks
- Processing does not block user session.
- Typical and upper-bound batch timings satisfy success criteria thresholds.

## Suggested Local Commands

- `npm run lint`
- `npm run type-check`
- `npm run test`

## Done Criteria for Planning Phase

- Plan artifacts complete (`plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`).
- Constitution gates remain PASS after design artifacts.
- Feature is ready for `/speckit.tasks` task decomposition.


## Local Execution Runbook

### Step 1: Apply New Migrations

From the repository root:

```powershell
# Apply migrations 015–025 sequentially
# Note: Apply 025 (StageId type alignment) before 022-024 (SPs) are exercised
$migrations = @(
  "015_create_pipeline_runs.sql",
  "016_create_validation_results.sql",
  "017_create_matched_records.sql",
  "018_create_filter_rule_snapshots.sql",
  "019_create_denominator_snapshot.sql",
  "020_create_vw_denominator_local.sql",
  "021_create_metric_snapshots.sql",
  "025_align_stageid_types.sql",
  "022_create_usp_build_filtered_denominator.sql",
  "023_create_usp_apply_numerator_filters.sql",
  "024_create_usp_execute_pipeline_run.sql"
)

foreach ($m in $migrations) {
  sqlcmd -S ".\SQLEXPRESS" -d "ATTG_Usage2" -E -C -i "database/migrations/$m"
}
```

---

### Step 2: Seed Test Denominator Data (Local Development)

Since the external Mercury server is not accessible locally, seed `stage.DenominatorSnapshot` with test data:

```sql
-- Example: insert test denominator records for Maestro (ServiceCode 11420)
INSERT INTO stage.DenominatorSnapshot
  (EngagementID, Engagement, ClientID, Client, AccountChannel,
   EngagementServiceCode, EngagementStatus, ReleaseDate,
   ETD_ANSRAmt, FYTD_ANSRAmt, CreatedBy, UpdatedBy)
VALUES
  ('ENG-001', 'Test Engagement 1', 'CLI-001', 'Test Client 1', '2',
   '11420', 'Completed', '2025-06-01', 50000.00, 25000.00,
   'seed', 'seed'),
  ('ENG-002', 'Test Engagement 2', 'CLI-002', 'Test Client 2', '2',
   '11420', 'Released', '2025-03-15', 75000.00, 30000.00,
   'seed', 'seed');
```

---

### Step 3: Start the Dev Server

```powershell
cd src/frontend
npm run dev
```

---

### Step 4: Trigger a Pipeline Run

```powershell
# Trigger pipeline for Maestro (replace with actual ApplicationId)
$body = '{"applicationId":"<maestro-app-id>","triggerSource":"API"}'

Invoke-WebRequest -Uri "http://localhost:3000/api/pipeline/run" `
  -Method POST `
  -Headers @{
    "Content-Type"="application/json"
    "x-user-id"="30000000-0000-0000-0000-000000000001"
    "x-user-role"="administrator"
  } `
  -Body $body

# Expected HTTP status: 201
# Expected response keys: runId, applicationId, status, triggerSource, createDate, executionMode
```

---

### Step 5: Check Run Status

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/pipeline/<runId>" `
  -Headers @{
    "x-user-id"="30000000-0000-0000-0000-000000000001"
    "x-user-role"="administrator"
  }

# Expected HTTP status: 200
# Expected response keys: runId, applicationId, status, startTime, endTime,
# triggerSource, snapshotDate, totalRecordsIn, validCount, invalidCount,
# duplicateCount, filteredOutCount, matchedCount, errorMessage, createDate
```

---

### Step 6: View Validation Results

```powershell
# Error summary for an application
Invoke-WebRequest -Uri "http://localhost:3000/api/pipeline/validation-results/<appId>/summary" `
  -Headers @{
    "x-user-id"="30000000-0000-0000-0000-000000000001"
    "x-user-role"="administrator"
  }

# Detailed results for a run (filtered by status)
Invoke-WebRequest -Uri "http://localhost:3000/api/pipeline/validation-results/<appId>?runId=<runId>&status=Invalid&page=1&pageSize=50" `
  -Headers @{
    "x-user-id"="30000000-0000-0000-0000-000000000001"
    "x-user-role"="administrator"
  }

# Expected HTTP status: 200
# Expected response keys: applicationId, runId, totalCount, page, pageSize, results[]
```

---

## Operational Troubleshooting (ADF and Local Fallback)

### ADF execution path troubleshooting

- Symptom: `POST /api/pipeline/run` returns `500` when ADF is expected.
  - Check that `ADF_PIPELINE_TRIGGER_ENDPOINT` is set and reachable from the app runtime.
  - Check that `ADF_PIPELINE_TRIGGER_TOKEN` (if required by your endpoint) is present and valid.
  - Verify the target ADF pipeline accepts `applicationId`, `runId`, `triggerSource`, `actorUserId`.

- Symptom: Run remains `Queued` and never transitions.
  - Verify ADF activity invocation for `app.usp_ExecutePipelineRun` succeeded.
  - Confirm SQL linked service credentials can execute `app.usp_ExecutePipelineRun`.
  - Review ADF activity output and SQL error details for permission or parameter issues.

### Local fallback troubleshooting

- Symptom: Trigger succeeds but no processing occurs in local mode.
  - Ensure ADF env vars are intentionally unset for local fallback mode.
  - Verify DB connectivity for the app runtime and that `app.usp_ExecutePipelineRun` exists.
  - Confirm the target `RunId` row exists in `app.PipelineRuns` with status `Queued` before execution.

- Symptom: SQL TLS/certificate connection errors with local sqlcmd checks.
  - Use `-C` with `sqlcmd` for local trusted-certificate bypass during development.

### Data-path troubleshooting

- Symptom: Zero validation rows after run.
  - Validate source data exists in `stage.EngagementUsageRaw` for the target `ApplicationId`.
  - Confirm denominator seed/snapshot data exists in `stage.DenominatorSnapshot`.
  - Confirm match key and adoption settings align with payload fields.

---

## Validation Command Outcomes

Executed on 2026-05-06 from repository root:

```powershell
npm run lint
npm run type-check
npm run test -- --reporter=dot
```

Observed outcomes:

- `npm run lint`: passed (no lint errors).
- `npm run type-check`: passed (no type errors).
- `npm run test -- --reporter=dot`: passed.
  - Test files: `70 passed`
  - Tests: `227 passed | 1 skipped (228)`
  - Duration: `34.90s`

These command results satisfy the phase validation requirement for local quality gates.

---

## Running Tests

```powershell
cd src/frontend
npm test
```

Tests run against in-memory repositories (no database required). The Vitest global setup auto-bootstraps a test server on port 3110.

---

## Key Files

### API Layer

| File | Purpose |
|------|---------|
| `src/frontend/app/api/numerator/route.ts` | Numerator ingestion API entrypoint (staging input to processing flow). |
| `src/frontend/app/api/applications/route.ts` | Application lookup endpoint used by feature workflows. |
| `src/frontend/app/api/filters/numerator/[appId]/route.ts` | Numerator filter rule management API. |
| `src/frontend/app/api/filters/denominator/[appId]/route.ts` | Denominator filter rule management API. |
| `src/frontend/app/api/filters/denominator/[appId]/preview/route.ts` | Denominator impact preview API. |
| `src/frontend/app/api/filters/denominator/[appId]/settings/route.ts` | Adoption settings API (match key and revenue metric inputs). |

### Core/Application Layer

| File | Purpose |
|------|---------|
| `src/frontend/core/application/services/NumeratorIngestionService.ts` | Application service for numerator ingestion use-case orchestration. |
| `src/frontend/core/application/services/NumeratorFilterService.ts` | Application service for numerator rule execution semantics. |
| `src/frontend/core/application/services/DenominatorFilterService.ts` | Application service for denominator rule execution semantics. |

### Infrastructure/Persistence Layer

| File | Purpose |
|------|---------|
| `src/frontend/infrastructure/persistence/runtime/repositories.ts` | Runtime repository wiring (db/memory selection). |
| `src/frontend/infrastructure/persistence/database/queries/numerator-filter-queries.ts` | SQL query primitives for numerator filter persistence. |
| `src/frontend/infrastructure/persistence/database/queries/denominator-filter-queries.ts` | SQL query primitives for denominator filter persistence. |

### UI Layer

| File | Purpose |
|------|---------|
| `src/frontend/app/components/ValidationSummary.tsx` | UI component for validation outcome summary rendering. |

### Database Schema

| File | Purpose |
|------|---------|
| `database/schema/stage/EngagementUsageRaw.sql` | Staging table schema for numerator payloads. |
| `database/schema/app/ApplicationModelFields.sql` | App model field metadata for JSON parsing. |
| `database/schema/app/NumeratorFilterRules.sql` | Numerator filter rule schema with canonical operators. |
| `database/schema/app/DenominatorModels.sql` | Denominator model metadata schema. |
| `database/schema/app/DenominatorFilterRules.sql` | Denominator filter rule schema with canonical operators. |
| `database/schema/app/AdoptionSettings.sql` | Per-application adoption-level and revenue metric settings. |

### Database Migrations

| File | Purpose |
|------|---------|
| `database/migrations/001_create_schemas.sql` | Base schema initialization. |
| `database/migrations/004_create_stage_engagement_usage_raw.sql` | Migration for numerator staging table. |
| `database/migrations/006_create_application_model_fields.sql` | Migration for model field metadata. |
| `database/migrations/007_create_numerator_filter_rules.sql` | Migration for numerator filter rules. |
| `database/migrations/010_create_denominator_models.sql` | Migration for denominator model fields. |
| `database/migrations/011_create_denominator_filter_rules.sql` | Migration for denominator filter rules. |
| `database/migrations/012_create_adoption_settings.sql` | Migration for adoption settings. |
| `database/migrations/015_create_pipeline_runs.sql` | Pipeline run lifecycle table migration. |
| `database/migrations/016_create_validation_results.sql` | Per-record validation result persistence migration. |
| `database/migrations/017_create_matched_records.sql` | Numerator-denominator matched record persistence migration. |
| `database/migrations/018_create_filter_rule_snapshots.sql` | Rule snapshot tracking migration per pipeline run. |
| `database/migrations/019_create_denominator_snapshot.sql` | Local denominator snapshot table migration. |
| `database/migrations/020_create_vw_denominator_local.sql` | Local denominator projection view migration. |
| `database/migrations/021_create_metric_snapshots.sql` | Metric snapshot table migration (schema-only for this epic). |
| `database/migrations/022_create_usp_build_filtered_denominator.sql` | Stored procedure scaffold for denominator filtering. |
| `database/migrations/023_create_usp_apply_numerator_filters.sql` | Stored procedure scaffold for numerator filter application. |
| `database/migrations/024_create_usp_execute_pipeline_run.sql` | Stored procedure scaffold for run orchestration. |
| `database/migrations/025_align_stageid_types.sql` | StageId type alignment migration for run artifacts. |
| `database/rollback/rollback_015_025_validation_processing.sql` | Consolidated rollback script for validation processing scaffolding. |

### Planning Artifacts

| File | Purpose |
|------|---------|
| `specs/007-validation-processing-pipeline/spec.md` | Feature requirements and scenarios. |
| `specs/007-validation-processing-pipeline/plan.md` | Technical plan and architecture alignment. |
| `specs/007-validation-processing-pipeline/data-model.md` | Data entities and relationships for the pipeline. |
| `specs/007-validation-processing-pipeline/contracts/processing-workflow-contract.md` | API/SP contracts including ADF production orchestration requirement. |
