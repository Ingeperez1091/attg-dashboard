# Data Model: Validation Processing Pipeline (EPIC-BQM-006)

**Feature Branch**: `007-validation-procesing-pipeline`  
**Date**: 2026-04-16  
**Spec**: [spec.md](spec.md)  
**Architecture**: `Documentation/ProjectSpecifications/architecture.md`

---

## 1. New Entities

### 1.1 PipelineRuns
Represents a single execution of the validation pipeline for one application.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `RunId` | UNIQUEIDENTIFIER | No | `NEWID()` | Primary key |
| `ApplicationId` | UNIQUEIDENTIFIER | No | — | FK → `app.Applications` |
| `Status` | NVARCHAR(32) | No | `'Queued'` | `Queued`, `Processing`, `Completed`, `Failed` |
| `StartTime` | DATETIME2 | Yes | — | Set when status transitions to `Processing` |
| `EndTime` | DATETIME2 | Yes | — | Set when status transitions to `Completed` or `Failed` |
| `TriggerSource` | NVARCHAR(64) | No | — | e.g., `API`, `ADF`, `Manual` |
| `TotalRecordsIn` | INT | Yes | — | Total staged records read |
| `ValidCount` | INT | Yes | — | Records passing ID validation |
| `InvalidCount` | INT | Yes | — | Records failing ID validation |
| `DuplicateCount` | INT | Yes | — | Repeated incoming numerator keys (occurrences after the first) |
| `FilteredOutCount` | INT | Yes | — | Records excluded by numerator filters |
| `MatchedCount` | INT | Yes | — | Records in final numerator ∩ denominator intersection |
| `ErrorMessage` | NVARCHAR(MAX) | Yes | — | Top-level error if pipeline fails |
| `SnapshotDate` | DATETIME2 | Yes | — | Date of the denominator snapshot used |
| `CreateDate` | DATETIME2 | No | `GETUTCDATE()` | Audit |
| `CreatedBy` | NVARCHAR(128) | No | — | Audit |
| `UpdateDate` | DATETIME2 | No | `GETUTCDATE()` | Audit |
| `UpdatedBy` | NVARCHAR(128) | No | — | Audit |

**Indexes**:
- PK on `RunId`
- IX on `ApplicationId, Status` (find latest run per app)
- IX on `ApplicationId, CreateDate DESC` (recent runs query)

**Relationships**:
- `ApplicationId` → `app.Applications.ApplicationId`

**State Transitions**:
```
- Queued -> Processing
    - Processing -> Completed
    - Processing -> Failed
```

**State Transitions**:
- Exactly one `ApplicationId` per run.
- Counts are non-negative and internally consistent at completion.
- `EndTime` is required when status is `Completed` or `Failed`.


---

### 1.2 ValidationResults

Description: Per-record validation outcome for a pipeline run.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `ResultId` | UNIQUEIDENTIFIER | No | `NEWID()` | Primary key |
| `PipelineRunId` | UNIQUEIDENTIFIER | No | — | FK → `app.PipelineRuns` |
| `StageId` | NVARCHAR(36) | No | — | FK → `stage.EngagementUsageRaw.StageId` (UNIQUEIDENTIFIER cast to string) |
| `ApplicationId` | UNIQUEIDENTIFIER | No | — | FK → `app.Applications` (denormalized for query performance) |
| `RecordKey` | NVARCHAR(256) | Yes | — | The Engagement ID or Client ID extracted from the record |
| `Status` | NVARCHAR(32) | No | — | `Valid`, `Invalid`, `Duplicate`, `FilteredOut` |
| `ErrorMessage` | NVARCHAR(512) | Yes | — | Human-readable error context |
| `CreateDate` | DATETIME2 | No | `GETUTCDATE()` | Audit |
| `CreatedBy` | NVARCHAR(128) | No | — | Audit |
| `UpdateDate` | DATETIME2 | No | `GETUTCDATE()` | Audit |
| `UpdatedBy` | NVARCHAR(128) | No | — | Audit |

**Indexes**:
- PK on `ResultId`
- IX on `PipelineRunId, Status` (aggregate counts per run)
- IX on `ApplicationId, PipelineRunId` (role-scoped queries)

**Relationships**:
- `PipelineRunId` → `app.PipelineRuns.RunId`
- `ApplicationId` → `app.Applications.ApplicationId`

**Status Values**:
| Status | Meaning |
|--------|---------|
| `Valid` | ID found in filtered denominator; passed all checks |
| `Invalid` | ID not found in filtered denominator, or null/empty ID |
| `Duplicate` | Same match key appeared earlier in batch (this is the older duplicate) |
| `FilteredOut` | Passed ID validation but excluded by a numerator filter rule |

**Validation rules**:
- One validation result per staged source record per run.
- `ErrorMessage` required for non-Valid statuses.
- `RecordKey` required except when parse failure prevents extraction.

---

### 1.3 MatchedRecords

Description: Numerator record that passed validation and rule checks and matched denominator.

Numerator records that passed all validation gates and matched a denominator entry.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `MatchedId` | UNIQUEIDENTIFIER | No | `NEWID()` | Primary key |
| `PipelineRunId` | UNIQUEIDENTIFIER | No | — | FK → `app.PipelineRuns` |
| `ApplicationId` | UNIQUEIDENTIFIER | No | — | FK → `app.Applications` |
| `NumeratorKey` | NVARCHAR(256) | No | — | Engagement ID or Client ID from numerator |
| `DenominatorKey` | NVARCHAR(256) | No | — | Matching key from filtered denominator |
| `RevenueAmount` | DECIMAL(18,2) | Yes | — | Revenue from denominator for this match |
| `StageId` | NVARCHAR(36) | Yes | — | Reference back to source staging record (UNIQUEIDENTIFIER cast to string) |
| `CreateDate` | DATETIME2 | No | `GETUTCDATE()` | Audit |
| `CreatedBy` | NVARCHAR(128) | No | — | Audit |
| `UpdateDate` | DATETIME2 | No | `GETUTCDATE()` | Audit |
| `UpdatedBy` | NVARCHAR(128) | No | — | Audit |

**Indexes**:
- PK on `MatchedId`
- IX on `PipelineRunId, ApplicationId` (metrics calculation query)
- IX on `ApplicationId, NumeratorKey` (uniqueness check within a run)

**Relationships**:
- `PipelineRunId` → `app.PipelineRuns.RunId`
- `ApplicationId` → `app.Applications.ApplicationId`


**Validation rules**:
- `NumeratorKey` and `DenominatorKey` are required.
- Duplicate matched rows for the same run/application/key are allowed when source numerator contains repeated valid records.

---

### 1.4 FilterRuleSnapshots

Description: Point-in-time copy of active denominator and numerator rules used by one run.
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `SnapshotId` | UNIQUEIDENTIFIER | No | `NEWID()` | Primary key |
| `PipelineRunId` | UNIQUEIDENTIFIER | No | — | FK → `app.PipelineRuns` |
| `RuleType` | NVARCHAR(32) | No | — | `Numerator` or `Denominator` |
| `RulesJson` | NVARCHAR(MAX) | No | — | JSON-serialized rules array |
| `VersionTag` | NVARCHAR(128) | Yes | — |  |
| `CreateDate` | DATETIME2 | No | `GETUTCDATE()` | Audit |
| `CreatedBy` | NVARCHAR(128) | No | — | Audit |
| `UpdateDate` | DATETIME2 | No | `GETUTCDATE()` | Audit |
| `UpdatedBy` | NVARCHAR(128) | No | — | Audit |

**Indexes**:
- PK on `SnapshotId`
- UQ on `PipelineRunId, RuleType` (one snapshot per type per run)

**Relationships**:
- `PipelineRunId` → `app.PipelineRuns.RunId`

**Validation rules**:
- At least one Denominator snapshot row and one Numerator snapshot row per run.
- `RulesJson` must be valid JSON.

---

### 1.5 DenominatorSnapshot (stage schema)

Local weekly copy of the external Mercury denominator view.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `SnapshotId` | INT IDENTITY | No | — | Primary key (auto-increment) |
| `EngagementID` | NVARCHAR(64) | Yes | — | Mercury Engagement ID |
| `Engagement` | NVARCHAR(512) | Yes | — | Engagement name |
| `ClientID` | NVARCHAR(64) | Yes | — | Mercury Client ID |
| `Client` | NVARCHAR(512) | Yes | — | Client name |
| `AccountChannel` | NVARCHAR(32) | Yes | — | Account channel code |
| `EngagementSubServiceLine` | NVARCHAR(128) | Yes | — | Sub-service line |
| `EngagementServiceCode` | NVARCHAR(32) | Yes | — | Service code |
| `EngagementService` | NVARCHAR(256) | Yes | — | Service description |
| `EngagementStatus` | NVARCHAR(64) | Yes | — | Engagement status |
| `CreationDate` | DATETIME2 | Yes | — | Engagement creation date |
| `ReleaseDate` | DATETIME2 | Yes | — | Engagement release date |
| `ETD_ANSRAmt` | DECIMAL(18,2) | Yes | — | ANSR/Tech Revenue ETD |
| `FYTD_ANSRAmt` | DECIMAL(18,2) | Yes | — | ANSR/Tech Revenue FYTD |
| `ETD_TERAmt` | DECIMAL(18,2) | Yes | — | TER ETD |
| `FYTD_TERAmt` | DECIMAL(18,2) | Yes | — | TER FYTD |
| `ETD_ChargedHours` | DECIMAL(18,2) | Yes | — | Charged Hours ETD |
| `FYTD_ChargedHours` | DECIMAL(18,2) | Yes | — | Charged Hours FYTD |
| `LoadDate` | DATETIME2 | No | `GETUTCDATE()` | When this snapshot was loaded |
| `CreateDate` | DATETIME2 | No | `GETUTCDATE()` | Audit |
| `CreatedBy` | NVARCHAR(128) | No | `'PL_DenomLoad_Weekly'` | Audit |
| `UpdateDate` | DATETIME2 | No | `GETUTCDATE()` | Audit |
| `UpdatedBy` | NVARCHAR(128) | No | `'PL_DenomLoad_Weekly'` | Audit |

**Indexes**:
- PK on `SnapshotId`
- IX on `EngagementID` (engagement-level joins)
- IX on `ClientID` (client-level joins)
- IX on `EngagementServiceCode` (denominator filtering)

**Load Strategy**: Truncate + full reload on weekly ADF schedule. `LoadDate` records when the snapshot was refreshed.

---

### 1.6 MetricSnapshots

Historical calculated metrics per pipeline run. (May already be partially defined in architecture; migration ensures it exists.)

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `SnapshotId` | UNIQUEIDENTIFIER | No | `NEWID()` | Primary key |
| `ApplicationId` | UNIQUEIDENTIFIER | No | — | FK → `app.Applications` |
| `CalculationDate` | DATETIME2 | No | `GETUTCDATE()` | When metrics were computed |
| `PipelineRunId` | UNIQUEIDENTIFIER | Yes | — | FK → `app.PipelineRuns` (null for legacy/seed data) |
| `DenominatorCount` | INT | No | — | Addressable population count |
| `NumeratorCount` | INT | No | — | Validated numerator count |
| `MatchedCount` | INT | No | — | Matched (intersection) count |
| `AdoptionPct` | DECIMAL(7,4) | No | — | Adoption percentage |
| `DenominatorRevenue` | DECIMAL(18,2) | Yes | — | Total addressable revenue |
| `NumeratorRevenue` | DECIMAL(18,2) | Yes | — | Total numerator revenue |
| `RevenuePct` | DECIMAL(7,4) | Yes | — | Revenue adoption percentage |
| `CreateDate` | DATETIME2 | No | `GETUTCDATE()` | Audit |
| `CreatedBy` | NVARCHAR(128) | No | — | Audit |
| `UpdateDate` | DATETIME2 | No | `GETUTCDATE()` | Audit |
| `UpdatedBy` | NVARCHAR(128) | No | — | Audit |

**Indexes**:
- PK on `SnapshotId`
- IX on `ApplicationId, CalculationDate DESC` (latest metrics per app)

**Relationships**:
- `ApplicationId` → `app.Applications.ApplicationId`
- `PipelineRunId` → `app.PipelineRuns.RunId` (optional)

---

## 2. Views

### 2.1 app.vw_DenominatorLocal

Thin view over `stage.DenominatorSnapshot` providing a stable query interface for stored procedures.

```sql
CREATE VIEW app.vw_DenominatorLocal AS
SELECT
    EngagementID, Engagement, ClientID, Client,
    AccountChannel, EngagementSubServiceLine,
    EngagementServiceCode, EngagementService,
    EngagementStatus, CreationDate, ReleaseDate,
    ETD_ANSRAmt, FYTD_ANSRAmt, ETD_TERAmt,
    FYTD_TERAmt, ETD_ChargedHours, FYTD_ChargedHours,
    LoadDate
FROM stage.DenominatorSnapshot;
```

All downstream processing (`usp_BuildFilteredDenominator`, ID validation JOINs, metric calculation) queries this view — never the external Mercury server.

---

## 3. Existing Entities Referenced (No Changes)

These tables are consumed by the pipeline but were created by earlier epics:

| Entity | Schema | Created By | Usage in Pipeline |
|--------|--------|------------|-------------------|
| `Applications` | `app` | EPIC-001 | Application registry; `ApplicationId` parameterizes pipeline |
| `ApplicationModelFields` | `app` | EPIC-006 | Numerator field definitions for JSON parsing |
| `NumeratorFilterRules` | `app` | EPIC-006 | Numerator filter rules applied in Step 4 |
| `DenominatorModels` | `app` | EPIC-008 | Mercury column definitions for denominator filtering |
| `DenominatorFilterRules` | `app` | EPIC-008 | Per-app denominator filter rules applied in Step 2 |
| `AdoptionSettings` | `app` | EPIC-008 | Adoption level, revenue metric, match key per app |
| `EngagementUsageRaw` | `stage` | EPIC-004 | Staged numerator JSON payloads (pipeline input) |
| `Users` | `app` | EPIC-002 | User identity for authorization checks |
| `UserApplications` | `app` | EPIC-002 | User-application assignments for role-scoped queries |
| `Roles` | `app` | EPIC-001 | Role definitions for authorization |
| `RuleChangeAudit` | `app` | EPIC-006 | Audit log for filter rule modifications |

---

## 4. Supporting Concept: Addressable Population

Description: Filtered denominator result set used for validation and matching.

Derived from:
- Local denominator snapshot (`stage.DenominatorSnapshot` / `app.vw_DenominatorLocal`)
- `DenominatorFilterRules` + `DenominatorModels`

Constraints:
- AND-combined rule behavior.
- Derived once per run and used consistently for run duration.

## 5. Supporting Concept: Application Processing Configuration

Description: Active per-application configuration loaded before run execution.

Includes:
- `ApplicationModelFields`
- `DenominatorModels`
- `DenominatorFilterRules`
- `NumeratorFilterRules`
- `AdoptionSettings`

Constraints:
- Configuration loaded at run start.
- Rule snapshot persisted for deterministic replay/audit.

---

## 6. Entity Relationship Diagram

```
┌──────────────┐       ┌───────────────────┐       ┌────────────────────┐
│ Applications │──1:N──│  PipelineRuns     │──1:N──│ ValidationResults  │
│              │       │  (one per app     │       │ (one per record    │
│              │       │   per execution)  │       │  per run)          │
│              │       └────────┬──────────┘       └────────────────────┘
│              │                │
│              │                ├──1:N──┐
│              │                │       │
│              │       ┌────────┴───────┴───┐
│              │       │  MatchedRecords    │
│              │       │  (intersection     │
│              │       │   results)         │
│              │       └────────────────────┘
│              │                │
│              │                ├──1:2──┐
│              │       ┌────────┴───────┴───┐
│              │       │ FilterRuleSnapshots│
│              │       │ (Num + Denom per   │
│              │       │  run)              │
│              │       └────────────────────┘
│              │                │
│              │                ├──1:1──┐
│              │       ┌────────┴───────┴───┐
│              │──1:N──│  MetricSnapshots   │
│              │       │  (calculated       │
└──────────────┘       │   metrics)         │
                       └────────────────────┘

┌───────────────────────────┐
│ stage.DenominatorSnapshot │ ← weekly ADF load from external Mercury server
│                           │
│ → app.vw_DenominatorLocal │ ← view; all pipeline queries go here
└───────────────────────────┘

┌──────────────────────────┐
│ stage.EngagementUsageRaw │ ← numerator JSON payloads (pipeline input)
└──────────────────────────┘

┌───────────────────────────┐        ┌───────────────────────────┐
│ app.DenominatorModels     │──1:N──→│ app.DenominatorFilterRules│
│ (shared, 17 columns)      │        │ (per-app rules)           │
└───────────────────────────┘        └───────────────────────────┘

┌───────────────────────────┐        ┌──────────────────────────┐
│ app.ApplicationModelFields│──1:N──→│ app.NumeratorFilterRules │
│ (per-app fields)          │        │ (per-app rules)          │
└───────────────────────────┘        └──────────────────────────┘
```

---

## 7. Pipeline Data Flow (Entity-Centric)

```
stage.EngagementUsageRaw  ──→ [Parse JSON via ApplicationModelFields]
                               │
                               ▼
                          Parsed Records (in-memory / temp table)
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
   Duplicate Detection    ID Validation       Null/Empty Check
   (ROW_NUMBER)           (JOIN vw_DenominatorLocal)
          │                    │                    │
          └────────────────────┼────────────────────┘
                               ▼
                    app.ValidationResults  ← status per record
                               │
                    (Valid records only)
                               ▼
                    [Apply NumeratorFilterRules]
                               │
                    (Filtered-out → ValidationResults)
                               ▼
                    Validated + Filtered Numerator
                               │
    app.vw_DenominatorLocal ──→│←── [usp_BuildFilteredDenominator]
                               │
                               ▼
                    [INNER JOIN on matchKey]
                               │
                               ▼
                    app.MatchedRecords  ← intersection
                               │
                               ▼
                    app.MetricSnapshots ← calculated adoption %
                               │
                               ▼
                    app.PipelineRuns ← status → Completed
```

---

## 8. Migration Sequence

| Migration | Description | Dependencies |
|-----------|-------------|-------------|
| `015_create_pipeline_runs.sql` | `app.PipelineRuns` table | `app.Applications` (003) |
| `016_create_validation_results.sql` | `app.ValidationResults` table | `app.PipelineRuns` (015), `stage.EngagementUsageRaw` (004) |
| `017_create_matched_records.sql` | `app.MatchedRecords` table | `app.PipelineRuns` (015) |
| `018_create_filter_rule_snapshots.sql` | `app.FilterRuleSnapshots` table | `app.PipelineRuns` (015) |
| `019_create_denominator_snapshot.sql` | `stage.DenominatorSnapshot` table | `stage` schema (001) |
| `020_create_vw_denominator_local.sql` | `app.vw_DenominatorLocal` view | `stage.DenominatorSnapshot` (019) |
| `021_create_metric_snapshots.sql` | `app.MetricSnapshots` table | `app.PipelineRuns` (015) |
| `022_create_usp_build_filtered_denominator.sql` | `app.usp_BuildFilteredDenominator` SP | `app.DenominatorFilterRules` (011), `app.DenominatorModels` (010), `app.vw_DenominatorLocal` (020) |
| `023_create_usp_apply_numerator_filters.sql` | `app.usp_ApplyNumeratorFilters` SP | `app.NumeratorFilterRules` (007), `app.ApplicationModelFields` (006), `app.ValidationResults` (016) |
| `024_create_usp_execute_pipeline_run.sql` | `app.usp_ExecutePipelineRun` orchestrator SP | 022, 023, 015–021 |
| `025_align_stageid_types.sql` | Alter `ValidationResults.StageId` and `MatchedRecords.StageId` from INT to NVARCHAR(36) | 016, 017 |