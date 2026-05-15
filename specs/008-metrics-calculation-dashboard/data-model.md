# Data Model: Metrics Calculation Dashboard (EPIC-BQM-007)

**Feature Branch**: `008-metrics-calculation-dashboard`  
**Date**: 2026-05-07  
**Spec**: [spec.md](spec.md)  
**Architecture**: `Documentation/ProjectSpecifications/architecture.md`

---

## Overview

EPIC-BQM-007 extends the existing validation pipeline (EPIC-BQM-006) by adding metrics calculation as the final orchestration step. The `PipelineRuns` and `AdoptionSettings` entities from EPIC-BQM-006 serve as the execution context; EPIC-BQM-007 adds new entities to persist KPI snapshots and interim synthetic investment data. Metrics calculation is implemented as a SQL stored procedure (`usp_CalculateMetrics`) invoked as the final step within `usp_ExecutePipelineRun` after matched records are persisted.

---

## 1. Existing Entities (from EPIC-BQM-006)

The following entities are defined in [007-validation-processing-pipeline/data-model.md](../007-validation-processing-pipeline/data-model.md) and are reused by EPIC-BQM-007 without modification:

### 1.1 PipelineRuns
**Source**: EPIC-BQM-006, `app.PipelineRuns`  
**Purpose**: Represents a single execution of the validation pipeline for one application, with metrics calculation as the final step.  
**Relevant Columns for EPIC-BQM-007**:
- `RunId` (primary key; used to link metrics snapshots)
- `ApplicationId` (scopes KPI calculation and retrieval)
- `Status` (lifecycle; `Completed` only after metrics snapshot persists)
- `MatchedCount` (operational summary from matching step; distinct-key KPI numerators are derived in `MetricSnapshots.NumeratorCount`)
- `CreateDate`, `UpdateDate` (audit)

### 1.2 MatchedRecords
**Source**: EPIC-BQM-006, `app.MatchedRecords`  
**Purpose**: Numerator records that passed validation and matched the filtered denominator.  
**Relevant Columns for EPIC-BQM-007**:
- `PipelineRunId` (links to the run context)
- `ApplicationId` (scopes KPI calculation)
- `RevenueAmount` (used in revenue-percentage formula)
- `DenominatorKey` (identifies denominator row for population roll-up aggregations)

### 1.3 FilterRuleSnapshots
**Source**: EPIC-BQM-006, `app.FilterRuleSnapshots`  
**Purpose**: Point-in-time copy of rules active when the run executed.  
**Relevant Columns for EPIC-BQM-007**:
- `PipelineRunId` (links to run context)
- `RulesJson` (preserved for traceability; linked to each metrics snapshot)

### 1.4 AdoptionSettings
**Source**: EPIC-BQM-006 (from `006-denominator-rules-config` spec), `app.AdoptionSettings`  
**Purpose**: Per-application adoption configuration controlling match-key type and revenue metric selection.  
**Relevant Columns for EPIC-BQM-007**:
- `SettingId` (primary key)
- `ApplicationId` (scopes KPI calculation; unique constraint enforces one active setting per app)
- `AdoptionLevel` (`Engagement` or `Client`; determines KPI aggregation logic)
- `RevenueMetric` (e.g., `ETD_ANSRAmt`, `FYTD_ANSRAmt`; selects denominator revenue column)
- `NumeratorSource` (`API` or `Manual`; source type for numerator data)

---

## 2. Metrics Entities in Scope (EPIC-BQM-007)

The following entities are in scope for EPIC-BQM-007. `MetricSnapshots` is an existing entity extended and normalized for the metrics-calculation contract; `InterimInvestmentDummyFacts` is introduced by this epic.

### 2.1 MetricSnapshots
Represents the immutable KPI result for a single successful calculation run and application scope, persisted as the final step of the pipeline. This table pre-existed EPIC-BQM-007 and is normalized here to use a single canonical run-link column (`RunId`) and a single canonical revenue percentage column (`RevenuePct`).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `SnapshotId` | UNIQUEIDENTIFIER | No | `NEWID()` | Primary key |
| `RunId` | UNIQUEIDENTIFIER | No | — | FK → `app.PipelineRuns.RunId` (governs run completion gate) |
| `ApplicationId` | UNIQUEIDENTIFIER | No | — | FK → `app.Applications` (denormalized for query performance) |
| `CalculationDate` | DATETIME2 | No | `GETUTCDATE()` | Timestamp of metric calculation |
| `DenominatorCount` | INT | No | — | Count of DISTINCT denominator keys in filtered denominator population (ClientID or EngagementID based on `AdoptionLevel`) |
| `NumeratorCount` | INT | No | — | Count of DISTINCT numerator keys that passed validation and matched denominator scope |
| `MatchedCount` | INT | No | — | Count of matched rows in `app.MatchedRecords` (audit trace; may exceed distinct key count when numerator has repeated valid rows) |
| `AdoptionPct` | DECIMAL(10, 4) | No | — | Adoption Percentage: (NumeratorCount / NULLIF(DenominatorCount, 0)) * 100 |
| `DenominatorRevenue` | DECIMAL(18, 2) | Yes | — | Total addressable revenue from filtered denominator population (for audit and traceability) |
| `NumeratorRevenue` | DECIMAL(18, 2) | Yes | — | Total numerator revenue summed from all matched records (including duplicates) from model metric field (`IsMetricDimension` source path) |
| `RevenuePct` | DECIMAL(10, 4) | No | — | Revenue Percentage: (NumeratorRevenue / NULLIF(DenominatorRevenue, 0)) * 100 |
| `AvgEngagement` | DECIMAL(10, 4) | Yes | — | Average engagement score for matched records (aggregation-driven) |
| `MetricDefinitionVersion` | NVARCHAR(32) | No | — | Version of formula/governance applied (e.g., "EPIC-007-v1") |
| `RefreshTimestamp` | DATETIME2 | No | `GETUTCDATE()` | When snapshot was persisted (locks immutability) |
| `SourceBatchId` | NVARCHAR(256) | Yes | — | Batch or run identifier for lineage |
| `FilterRuleSnapshotId` | UNIQUEIDENTIFIER | Yes | — | FK → `app.FilterRuleSnapshots.SnapshotId` (links to Denominator rule context) |
| `CreateDate` | DATETIME2 | No | `GETUTCDATE()` | Audit |
| `CreatedBy` | NVARCHAR(128) | No | — | Audit |

**Removed legacy columns**:
- `PipelineRunId` was superseded by `RunId`.
- `RevenueCapturePct` was superseded by `RevenuePct`.
- `MatchedRevenue` was removed as it is redundant with `NumeratorRevenue`.
- `UpdateDate` and `UpdatedBy` were removed because `MetricSnapshots` is append-only.

**Indexes**:
- PK on `SnapshotId`
- IX on `RunId` (find snapshot by run)
- IX on `ApplicationId, CalculationDate DESC` (most recent snapshot per app)
- IX on `ApplicationId, RefreshTimestamp DESC` (query latest metrics for display)

**Relationships**:
- `RunId` → `app.PipelineRuns.RunId` (governs pipeline run completion status)
- `ApplicationId` → `app.Applications.ApplicationId`
- `FilterRuleSnapshotId` → `app.FilterRuleSnapshots.SnapshotId` (optional, for audit trail)

### 2.2 Metric Calculation Definitions

The following canonical formulas are used to calculate and normalize all KPI metrics:

**Adoption Percentage (Engagement Metric)**:
```
engagement = Math.max(0, Math.min(100, adoptionPercent))
adoptionPercent = (NumeratorCount / NULLIF(DenominatorCount, 0)) * 100
AdoptionPct = ROUND(engagement, 4)
```
- **Clipping**: Values are bounded to [0, 100] to ensure valid percentage representation
- **Divide-by-zero safe**: Returns 0 if denominator count is null or zero
- **Semantics**: Represents the percentage of addressable population that matched and was validated

**Revenue Percentage (Revenue Share Metric)**:
```
revenueShare = Math.max(0, Math.min(100, revenuePct))
revenuePct = (NumeratorRevenue / NULLIF(DenominatorRevenue, 0)) * 100
RevenuePct = ROUND(revenueShare, 4)
```
- **Clipping**: Values are bounded to [0, 100] to ensure valid percentage representation
- **Divide-by-zero safe**: Returns 0 if denominator revenue is null or zero
- **Semantics**: Represents the percentage of addressable revenue captured by matched records
- **Revenue Basis Selection**: `revenueBasis = FYTD | ETD` is controlled by `app.AdoptionSettings.RevenueMetric` (e.g., `FYTD_ANSRAmt`, `ETD_ANSRAmt`)

**On Target Rate (High Adoption Indicator)**:
```
onTarget = isHighAdoption (engagementPercent > 70%)
onTarget = BOOLEAN(1 if adoption > 70%, else 0)
```
- **Storage**: NOT persisted in database. Calculated on-the-fly in UI layer from `adoptionPct`.
- **Threshold Policy**: Default 70% engagement threshold; can be overridden by approved governance policy versions
- **Semantics**: Boolean indicator showing whether adoption has reached the high-adoption threshold
- **UI Purpose**: Helper field to visually highlight applications meeting the 70% adoption requirement

**Average Engagement**:
```
AvgEngagement = SUM(EngagementScores) / NULLIF(COUNT(DISTINCT EngagementId), 0)
```
- **Current State**: NULL (awaiting per-matched-record engagement score data from numerator payload or enrichment)
- **Future Implementation**: Will aggregate engagement scores from matched records once engagement metric is available per record
- **Semantics**: Average engagement level across matched records, enabling assessment of quality beyond binary adoption

**Invariants**:
- Append-only (no updates or deletes after initial insert).
- One snapshot per successful run + application scope (per-run uniqueness).
- All percentage and rate columns are non-negative and ≤ 100.
- Divide-by-zero safe (KPI values remain 0 or null, never cause runtime exceptions).
- `RefreshTimestamp` must be ≥ `CalculationDate`.
- Snapshot is NOT committed unless run status transitions to `Completed` (transactional integrity).

---

### 2.2 InterimInvestmentDummyFacts
Non-authoritative synthetic investment records for non-production KPI development and testing (support for EPIC-007, unblocks EPIC-013 dependency).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `InvestmentId` | UNIQUEIDENTIFIER | No | `NEWID()` | Primary key |
| `ApplicationId` | UNIQUEIDENTIFIER | No | — | FK → `app.Applications` |
| `CalculationDate` | DATE | No | — | Business date for investment context (synthetic, not authoritative) |
| `InvestmentAmount` | DECIMAL(18, 2) | No | — | Dummy investment amount (non-authoritative) |
| `IsSynthetic` | BIT | No | `1` | Always 1; marks as non-authoritative and deterministic |
| `SyntheticBusinessKey` | NVARCHAR(256) | No | — | Unique constraint key for idempotency (composite: AppId + Date + ScopeKey) |
| `SourceBatchId` | NVARCHAR(256) | Yes | — | Batch identifier for seed operation lineage |
| `CreateDate` | DATETIME2 | No | `GETUTCDATE()` | Audit |
| `CreatedBy` | NVARCHAR(128) | No | — | Audit |

**Indexes**:
- PK on `InvestmentId`
- UX on `SyntheticBusinessKey` (enforce idempotent seeding)
- IX on `ApplicationId, CalculationDate` (query by app and date for composite KPI)
- IX on `IsSynthetic` (filter synthetic from authoritative; always = 1)

**Relationships**:
- `ApplicationId` → `app.Applications.ApplicationId`
- Separate lifecycle from PipelineRuns (no transactional dependency)

**Invariants**:
- `IsSynthetic` is always 1 (by definition; non-production only).
- `SyntheticBusinessKey` combination must be unique (idempotency).
- Non-production usage only; expose only in test/dev contexts via role-scoped retrieval.
- Row count and content are deterministic given a seed date and app scope.
- No direct foreign key from PipelineRuns (allows independent seeding schedule).

---

## 3. Component Relationships

```
PipelineRun (from EPIC-BQM-006, app.PipelineRuns)
├── 1-to-many → MatchedRecords (from EPIC-BQM-006, app.MatchedRecords)
│                 ├─ Input to KPI calculation (matched count, revenue aggregates)
│                 └─ Sourced from validation step
├── 1-to-many → FilterRuleSnapshots (from EPIC-BQM-006, app.FilterRuleSnapshots)
│                 └─ Rules snapshot preserved at run start for auditability
└── 1-to-0..1 → MetricSnapshots (NEW, app.MetricSnapshots)
                 ├─ Created by final calculation step (usp_CalculateMetrics)
                 ├─ At most one snapshot per RunId (re-runs require a new RunId)
                 ├─ Gates run completion status (must persist before Completed)
                 └─ References AdoptionSettings (logical influence via ApplicationId)

AdoptionSettings (from EPIC-BQM-006, app.AdoptionSettings)
└─ 1-to-many → MetricSnapshots (logical)
               └─ Adoption level and revenue basis control KPI formula selection

InterimInvestmentDummyFacts (NEW, app.InvestmentDummyFacts)
└─ Separate lifecycle (independent of run execution)
   └─ Used for non-production composite KPI payloads only
```

---

## 4. Pipeline Orchestration and Metrics Calculation

### Execution Context

Metrics calculation extends the existing validation pipeline with a final calculation step. The workflow is:

```
API Request (POST /api/pipeline/run { applicationId, triggerSource })
    ↓
Create PipelineRun (Status = Queued)
    ↓
Trigger ADF Pipeline OR Direct Execution (local dev)
    ↓
usp_ExecutePipelineRun @RunId, @ApplicationId
    ├─ Step 1: Denominator Filtering (usp_BuildFilteredDenominator)
    ├─ Step 2: Numerator Parsing & Deduplication
    ├─ Step 3: ID Validation
    ├─ Step 4: Numerator Filtering
    ├─ Step 5: Matching
    ├─ Step 6: Persist ValidationResults & MatchedRecords
    └─ Step 7: *** NEW *** Metrics Calculation (usp_CalculateMetrics)
            └─ Read matched records from app.MatchedRecords
            └─ Read adoption settings from app.AdoptionSettings
            └─ Calculate KPI values (deterministic SQL formulas)
            └─ Persist one snapshot to app.MetricSnapshots
            └─ Return success/failure to orchestrator
    ↓
Update PipelineRun Status
    ├─ If metrics snapshot persisted: Status = Completed
    └─ If calculation failed: Status = Failed (no partial snapshots committed)
    ↓
Return Result to Caller
```

### SQL Stored Procedure for Metrics Calculation

**Procedure Name**: `usp_CalculateMetrics`

**Purpose**: Calculate and persist KPI metrics as the final step of pipeline execution.

**Input Parameters**:
- `@RunId` UNIQUEIDENTIFIER
- `@ApplicationId` UNIQUEIDENTIFIER

**Processing Logic** (pseudo-code):
```sql
-- 1. Read adoption settings for application
SELECT @AdoptionLevel, @RevenueMetric FROM app.AdoptionSettings WHERE ApplicationId = @ApplicationId

-- 2. Build aggregates from app.MatchedRecords WHERE PipelineRunId = @RunId
SELECT
        COUNT(DISTINCT NumeratorKey) AS NumeratorCount,
        COUNT(*) AS MatchedCount
FROM app.MatchedRecords
WHERE PipelineRunId = @RunId
    AND ApplicationId = @ApplicationId

-- 3. Build aggregates from filtered denominator snapshot
SELECT
    COUNT(DISTINCT CASE WHEN @AdoptionLevel = 'client' THEN ClientID ELSE EngagementID END) AS DenominatorCount,
    SUM(TRY_CONVERT(DECIMAL(18,4), <RevenueMetric>)) AS DenominatorRevenue
FROM (
    -- Apply FilterRuleSnapshots to vw_DenominatorLocal
    -- Use dynamic SQL per app's denominator rules
) AS FilteredDenom

-- 4. Validation gate (distinct key parity):
-- Detect distinct numerator keys that are marked valid but do not exist in filtered denominator
IF EXISTS (<valid numerator key not in filtered denominator>)
    THROW

-- 5. Aggregate numerator revenue from all matched records (including duplicates) from model metric field (IsMetricDimension source path)
SELECT SUM(RevenueAmount) AS NumeratorRevenue
FROM app.MatchedRecords
WHERE PipelineRunId = @RunId AND ApplicationId = @ApplicationId

-- 6. Calculate KPI values (divide-by-zero safe):
AdoptionPct = (NumeratorCount / NULLIF(DenominatorCount, 0)) * 100
RevenuePct = (NumeratorRevenue / NULLIF(DenominatorRevenue, 0)) * 100
AvgEngagement = NULL

-- 7. Insert one row into app.MetricSnapshots
INSERT INTO app.MetricSnapshots (
    SnapshotId, RunId, ApplicationId, CalculationDate,
    DenominatorCount, NumeratorCount, MatchedCount,
    AdoptionPct, DenominatorRevenue, NumeratorRevenue, RevenuePct, AvgEngagement,
    MetricDefinitionVersion, RefreshTimestamp, SourceBatchId, FilterRuleSnapshotId,
    CreateDate, CreatedBy
)
VALUES (
    NEWID(), @RunId, @ApplicationId, GETUTCDATE(),
    @DenominatorCount, @NumeratorCount, @MatchedCount,
    @AdoptionPct, @DenominatorRevenue, @NumeratorRevenue, @RevenuePct, @AvgEngagement,
    N'EPIC-007-v1', GETUTCDATE(), NULL, @FilterRuleSnapshotId,
    GETUTCDATE(), 'usp_CalculateMetrics'
)

-- 8. If insert fails, raise exception to rollback entire run
-- 9. If success, return (0, 'OK') to orchestrator
```

**Performance Optimization**:
- All aggregations are SQL-native (no row-level iteration).
- Filtered denominator is built via parameterized `sp_executesql` with column name validation.
- Revenue columns are aggregated inline (no separate SQL queries).
- Indexes on `app.MatchedRecords(PipelineRunId, ApplicationId)` and `app.AdoptionSettings(IsActive, EffectiveDate)` support rapid lookups.
- Single INSERT to `MetricSnapshots` per run (O(1) persist operation).

**Transactional Behavior**:
- Entire `usp_CalculateMetrics` execution is wrapped in transaction context by caller `usp_ExecutePipelineRun`.
- If calculation or INSERT fails, transaction rolls back; no partial snapshot persists.
- Key invariant: `PipelineRuns.Status = Completed` is set ONLY after successful snapshot insert.

---

## 5. Pipeline State Transitions

### PipelineRun Lifecycle (Extended for EPIC-BQM-007)

```
Queued
  ↓
  ↓ (API triggers ADF or local invocation)
  ↓
Processing
  ├─ Validation steps execute (denominator filtering, ID validation, matching)
  ├─ MatchedRecords persisted to app.MatchedRecords
  ├─ ValidationResults persisted to app.ValidationResults
  ├─ FilterRuleSnapshots persisted (numerator + denominator rules)
  │
  └─ *** NEW: Metrics Calculation Step (usp_CalculateMetrics) ***
       ├─ Reads from app.MatchedRecords, app.AdoptionSettings, vw_DenominatorLocal
       ├─ Calculates KPI values
       └─ Inserts to app.MetricSnapshots
          ├─ SUCCESS: MetricSnapshots row committed
          └─ FAILURE: Exception; no snapshot persisted; run status remains Processing
  ↓
  ├─ Status → Completed (if metrics snapshot inserted successfully)
  │
  └─ Status → Failed (if metrics calculation fails, or any validation step fails)
```

### MetricSnapshot Lifecycle

```
NOT_EXISTS
  ↓
  ├─ When: usp_CalculateMetrics executes successfully as part of pipeline run
  ├─ Action: Single INSERT creates one immutable snapshot
    ├─ Recalculation rule: do not insert a second snapshot for the same RunId;
    │  trigger a new pipeline run to create a new snapshot under a new RunId
  │
  └─ PERSISTED (Immutable, Append-Only)
       ├─ No updates or deletes
       ├─ RefreshTimestamp locks immutability point
       └─ Queryable for trend analysis and audit
```

### Adoption Settings Lifecycle

```
CREATED (@EffectiveDate = T0) [from EPIC-BQM-006]
  ├─ Per application (unique on ApplicationId)
  └─ Controls KPI calculation for all runs after creation
  ↓
  ├─ When: new setting value needed for app
  ├─ Action: Update or insert new SettingId row with new EffectiveDate
  │
  └─ VERSIONED (Point-in-Time Auditability)
       └─ EPIC-BQM-007 uses active setting per app to determine adoption level and revenue metric
```

---

## 6. Calculated / Derived Values

The following formulas are implemented in T-SQL within `usp_CalculateMetrics`:

```
AdoptionPct = (NumeratorCount / NULLIF(DenominatorCount, 0)) * 100
            = 0 if DenominatorCount = 0 (divide-by-zero safe)
            = NumeratorCount and DenominatorCount are DISTINCT keys (ClientID or EngagementID per AdoptionLevel)

RevenuePct = (NumeratorRevenue / NULLIF(DenominatorRevenue, 0)) * 100
           = NumeratorRevenue is summed from ALL matched records (including duplicates)
           = DenominatorRevenue is aggregated from filtered denominator using AdoptionSettings.RevenueMetric
           = 0 if DenominatorRevenue = 0 (divide-by-zero safe)

onTarget = AdoptionPct > 70
         = UI-only helper boolean (not stored in MetricSnapshots)

AvgEngagement = SUM(EngagementScores) / NULLIF(COUNT(DISTINCT EngagementId), 0)
              = aggregation-driven per run scope
              = 0 if no engagement records (divide-by-zero safe)
```

All formulas:
- Return numeric (decimal) values, never throw exceptions
- Are deterministic: same inputs → same outputs
- Are SQL-native: no application-layer code paths
