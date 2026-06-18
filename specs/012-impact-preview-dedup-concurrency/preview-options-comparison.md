# Preview Feature — Implementation Options Comparison

**Feature Branch**: `012-impact-preview-dedup-concurrency`  
**Created**: 2026-06-12  
**Context**: Evaluate implementation approaches for the denominator rules impact preview, considering growth from 5 apps (MVP) to 200+ apps (full ATTG environment).

---

## Core Requirement: Full Adoption Metrics with Current/Projected Comparison

The preview feature must calculate **complete adoption metrics** (not just denominator count) and present a **current vs. projected** comparison so users understand the full impact of proposed rule changes before committing.

### Required Output

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Impact Preview — Application: Tax Compliance Pro                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────┐     ┌─────────────────────────┐               │
│  │   CURRENT (Committed)   │     │  PROJECTED (Staged Rules)│               │
│  ├─────────────────────────┤     ├─────────────────────────┤               │
│  │ Adoption %:     42.3%   │ ──► │ Adoption %:     58.7%   │  ▲ +16.4%    │
│  │ Revenue Share:  38.1%   │ ──► │ Revenue Share:  51.2%   │  ▲ +13.1%    │
│  │ Matched Count:  1,247   │ ──► │ Matched Count:  1,247   │    (same)    │
│  │ Denominator:    2,948   │ ──► │ Denominator:    2,124   │  ▼ -824      │
│  │ Denom Revenue:  $48.2M  │ ──► │ Denom Revenue:  $34.7M  │  ▼ -$13.5M  │
│  └─────────────────────────┘     └─────────────────────────┘               │
│                                                                             │
│  Rule Changes:                                                              │
│  + Added: EngagementStatus EQUALS 'Active'                                  │
│  + Added: EngagementServiceCode IN_LIST 'TAX01;TAX02;TAX03'                 │
│  ~ Modified: AccountChannel NOT_EQUALS 'Internal' → 'Indirect'             │
│  - Removed: CreationDate GREATER_THAN '2024-01-01'                          │
│                                                                             │
│  ⚠️  Denominator reduced by 28% — adoption % increases due to smaller base  │
│                                                                             │
│  [Cancel]                                           [Commit Rules & Re-run] │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Required Response Payload

```json
{
  "current": {
    "adoptionPct": 42.3,
    "revenueSharePct": 38.1,
    "matchedCount": 1247,
    "denominatorCount": 2948,
    "denominatorRevenue": 48200000.00
  },
  "projected": {
    "adoptionPct": 58.7,
    "revenueSharePct": 51.2,
    "matchedCount": 1247,
    "denominatorCount": 2124,
    "denominatorRevenue": 34700000.00
  },
  "delta": {
    "adoptionPct": 16.4,
    "revenueSharePct": 13.1,
    "matchedCount": 0,
    "denominatorCount": -824,
    "denominatorRevenue": -13500000.00
  },
  "warnings": [
    "Denominator reduced by 28% — adoption % increases due to smaller base"
  ],
  "previewRunId": "a1b2c3d4-...",
  "triggerSource": "Preview"
}
```

### Metrics Breakdown

| Metric | Formula | What Changes with Denominator Rules |
|--------|---------|-------------------------------------|
| **Adoption %** | `(distinct matched numerator keys / distinct denominator keys) × 100` | Denominator shrinks → adoption % increases (numerator stays same) |
| **Revenue Share %** | `(matched numerator revenue / denominator revenue) × 100` | Denominator revenue shrinks → revenue share % increases |
| **Matched Count** | `COUNT(numerator records IN denominator)` | May decrease if new rules exclude denominator records that matched |
| **Denominator Count** | `COUNT(DISTINCT denominator keys after filter)` | Directly affected by filter rules |
| **Denominator Revenue** | `SUM(revenue column) from filtered denominator` | Directly affected by filter rules |

### Sourcing "Current" Values

The "current" side is sourced from the **most recent completed non-preview pipeline run** for the application:
```sql
SELECT TOP 1 * FROM app.MetricSnapshots ms
INNER JOIN app.PipelineRuns pr ON pr.RunId = ms.PipelineRunId
WHERE pr.ApplicationId = @applicationId
  AND pr.Status = 'Completed'
  AND pr.TriggerSource != 'Preview'
ORDER BY pr.CompletedDate DESC;
```
No additional computation needed — it's a simple SELECT of already-persisted metrics.

---

## Constraint: Minimal SP Test Investment

The team has decided **not** to invest significant effort in SP-level unit testing (tSQLt, data fixtures, etc.). In-Memory repositories were a development-time convenience and are not the long-term strategy. This constraint favors approaches where the majority of testable logic lives in the TypeScript application layer.

---

## Option A: TypeScript Query Builder — Full Metrics via Application Layer

**Description**: Extend the existing TypeScript `buildDenominatorPreviewAggregateQuery()` function to compute full adoption metrics entirely in the application layer. After filtering the denominator with proposed rules, the service performs the numerator matching, adoption calculation, and revenue aggregation in TypeScript — replicating what the pipeline SPs do, but in application code against `app.vw_DenominatorLocal`.

### How It Works

```
Client POST /api/filters/denominator/:appId/preview
  → Zod validates request body
  → DenominatorFilterService.previewRules()
    → Loads DenominatorModels (column allowlist)
    → [CURRENT] Read latest MetricSnapshots for applicationId (simple SELECT)
    → [PROJECTED] Compute new metrics:
      → Step 1: buildDenominatorPreviewAggregateQuery() [TypeScript]
        → Builds parameterized WHERE clause against app.vw_DenominatorLocal
        → Returns { projectedDenominatorCount, projectedDenominatorRevenue }
      → Step 2: buildNumeratorMatchQuery() [TypeScript — NEW]
        → Queries stage.EngagementUsageRaw JOIN filtered denominator
        → Applies numerator filter rules
        → Returns { matchedCount, numeratorRevenue, distinctNumeratorKeys }
      → Step 3: Compute adoption metrics [TypeScript]
        → adoptionPct = (distinctNumeratorKeys / projectedDenominatorCount) × 100
        → revenueSharePct = (numeratorRevenue / projectedDenominatorRevenue) × 100
    → Compute delta (current - projected)
    → Generate warnings (e.g., >25% denominator reduction)
  → Returns { current, projected, delta, warnings }
```

### Pros

| # | Pro | Detail |
|---|-----|--------|
| 1 | **Fully testable in TypeScript** | All metric calculation logic is in pure functions — unit testable without a database. Integration tests verify SQL execution. |
| 2 | **No SP maintenance** | No stored procedure to version, deploy, or test separately. |
| 3 | **Security already implemented** | `assertSafeIdentifier()` + DenominatorModels allowlist already prevents injection. |
| 4 | **Transparent debugging** | All queries visible in application logs with parameters. Easy to reproduce issues. |
| 5 | **Full metric output** | Computes complete adoption metrics (adoption %, revenue share %, matched count) with current/projected comparison. |

### Cons

| # | Con | Detail |
|---|-----|--------|
| 1 | **Significant new TypeScript code** | Must reimplement numerator matching, dedup logic, and metric calculation in TypeScript — duplicating what the pipeline SPs already do. |
| 2 | **Logic divergence risk** | Two separate implementations of the same calculation (TS for preview, SP for pipeline). If pipeline logic changes, preview can produce different results. |
| 3 | **Multiple round-trips** | Requires 3+ database queries per preview (denominator filter, numerator match, current metrics). Network latency compounds. |
| 4 | **Plan cache pollution at scale** | Each unique combination of rules produces distinct query texts → new execution plans. At 200 apps, SQL Server plan cache fills with one-use plans. |
| 5 | **No query-level optimization** | TypeScript can't use `OPTION (RECOMPILE)`, query hints, or adaptive joins. |
| 6 | **Complex numerator matching in TS** | Numerator records are JSON payloads; parsing, deduplication, and revenue extraction in TypeScript is complex and memory-intensive at scale. |
| 7 | **Full table scan risk** | Without columnstore or covering indexes, aggregate queries with multi-column WHERE scan the entire snapshot table. At 500K+ rows, can exceed the 5-second SLA. |
| 8 | **No result caching** | Every preview click re-executes all queries — even with unchanged rules. |

### Scale Rating

| Scale | Fit |
|-------|-----|
| 5 apps, 50K rows | ⚠️ Acceptable — multiple queries complete in < 3s total |
| 20–50 apps, 200K rows | ❌ Degrades — numerator matching in TS becomes memory-intensive |
| 100–200+ apps, 500K+ rows | ❌ Unviable — multiple unoptimized queries exceed SLA |

### Performance / Benefit Assessment

| Aspect | Rating | Detail |
|--------|--------|--------|
| **Development cost** | 🟡 Medium | Must implement numerator match + metric calc in TypeScript (~200–400 lines new code) |
| **Time to deliver** | 🟡 2–3 sprints | New query builders + integration tests for multi-step calculation |
| **Metric accuracy** | 🔴 At risk | Separate code path from pipeline — drift is inevitable without rigorous parity testing |
| **User value** | 🟢 High | Full before/after comparison with all metrics |
| **Ongoing maintenance** | 🔴 High | Two implementations (TS + SP) of same logic must stay in sync |

---

## Option B: Dedicated Stored Procedure for Full Preview

**Description**: Create `usp_PreviewDenominatorImpact` that accepts `@ApplicationId` and `@RulesJson` (JSON array of rules), runs the full adoption calculation internally (denominator filtering, numerator matching, metric computation), and returns a complete metric result set. This SP re-implements the pipeline's multi-step logic in a single, self-contained procedure optimized for preview use.

### How It Works

```
Client POST /api/filters/denominator/:appId/preview
  → Zod validates request body
  → DenominatorFilterService.previewRules()
    → [CURRENT] Read latest MetricSnapshots for applicationId (simple SELECT)
    → [PROJECTED] Serialize proposed rules to JSON
    → EXEC usp_PreviewDenominatorImpact @AppId, @RulesJson, @RevenueMetric
      → SP parses JSON via OPENJSON
      → SP resolves column names from app.DenominatorModels (internal allowlist)
      → SP builds + executes dynamic denominator filter SQL (sp_executesql)
      → SP queries stage.EngagementUsageRaw, matches against filtered denominator
      → SP applies numerator filter rules
      → SP computes: adoptionPct, revenueSharePct, matchedCount, denominatorCount, denominatorRevenue
      → SP returns single-row result set with all metrics
    → Compute delta (current - projected)
    → Generate warnings
  → Returns { current, projected, delta, warnings }
```

### Pros

| # | Pro | Detail |
|---|-----|--------|
| 1 | **Full metric output** | Returns complete adoption metrics (adoption %, revenue share %, matched count, denominator count, revenue) in a single SP call. |
| 2 | **Query optimization control** | SP can use `OPTION (RECOMPILE)` for variable predicate shapes — avoids plan cache pollution entirely. |
| 3 | **Columnstore exploitation** | SP can include query hints that force columnstore index usage for aggregate queries, providing 5–10× speedup on large scans. |
| 4 | **Single round-trip** | All computation happens in one database call — no network latency compounding. |
| 5 | **Encapsulated data logic** | Revenue metric selection, column validation, numerator matching, and adoption calculation are all co-located with the data. |
| 6 | **Future caching hook** | SP can internally check a `PreviewCache` table (keyed by rules hash + LoadDate) and return cached results. |
| 7 | **DBA-optimizable** | Database team can tune the SP independently without application redeployment. |

### Cons

| # | Con | Detail |
|---|-----|--------|
| 1 | **Heavy SP testing investment** | Team constraint: minimal SP test effort. This SP contains the **entire pipeline logic** (denominator filter + numerator match + metric calc) — hundreds of lines of complex dynamic SQL that requires full testing. **Primary blocker.** |
| 2 | **Complete logic duplication** | Re-implements all of `usp_BuildFilteredDenominator` + `usp_ApplyNumeratorFilters` + `usp_CalculateMetrics` in a new SP. Two copies of the same business logic will drift. |
| 3 | **Deployment coupling** | SP changes require database migration deployment. Coordinating with app changes adds release friction. |
| 4 | **Opaque debugging** | Errors inside multi-step dynamic SQL within an SP are hard to diagnose from application logs. |
| 5 | **Migration overhead** | Large new SP to create, maintain, and version. Must be idempotent for re-runs. |
| 6 | **Drift risk** | If pipeline SPs change (new operators, metric formulas, dedup logic), the preview SP must be updated in lockstep or results diverge. |

### Scale Rating

| Scale | Fit |
|-------|-----|
| 5 apps, 50K rows | ✅ Works well — single-call completes in < 3s |
| 20–50 apps, 200K rows | ✅ Excellent — RECOMPILE + single transaction avoids bloat |
| 100–200+ apps, 500K+ rows | ✅ Best raw performance — all computation server-side with hints |

### Performance / Benefit Assessment

| Aspect | Rating | Detail |
|--------|--------|--------|
| **Development cost** | 🔴 High | Must implement full pipeline logic in a new SP (~300–500 lines of T-SQL with dynamic SQL) |
| **Time to deliver** | 🔴 3–4 sprints | Complex SP + integration tests + migration coordination |
| **Metric accuracy** | 🟡 At risk initially | Separate code path — must manually keep in sync with pipeline SPs |
| **User value** | 🟢 High | Full before/after comparison, fastest raw execution |
| **Ongoing maintenance** | 🔴 High | Two parallel implementations of pipeline logic (production SPs + preview SP) |

---

## Option C: Stored Procedure with Pre-Aggregated Indexed Views + Full Metrics

**Description**: Extend Option B's stored procedure with **indexed views** (materialized views in SQL Server) that pre-aggregate common denominator metrics by filterable dimensions. The SP queries indexed views for fast denominator aggregates when possible, then performs the full numerator matching and adoption calculation. Falls back to dynamic SQL for complex predicates.

### How It Works

```
Weekly denominator load (PL_DenomLoad_Weekly)
  → Populates stage.DenominatorSnapshot
  → SQL Server auto-maintains indexed views (materialized aggregates)

Client POST /api/filters/denominator/:appId/preview
  → Zod validates request body
  → DenominatorFilterService.previewRules()
    → [CURRENT] Read latest MetricSnapshots for applicationId (simple SELECT)
    → [PROJECTED] EXEC usp_PreviewDenominatorImpact @AppId, @RulesJson, @RevenueMetric
      → SP parses rules
      → SP checks if denominator predicate matches an indexed view signature
        → YES: Read pre-aggregated denominator counts + revenue (instant)
        → NO: Dynamic SQL against base table with OPTION (RECOMPILE)
      → SP performs numerator matching against filtered denominator set
      → SP applies numerator filter rules
      → SP computes: adoptionPct, revenueSharePct, matchedCount, denominatorCount, denominatorRevenue
      → SP returns single-row result set with all metrics
    → Compute delta (current - projected)
    → Generate warnings
  → Returns { current, projected, delta, warnings }
```

### Example Indexed View

```sql
CREATE VIEW app.vw_DenominatorAgg_ByServiceCodeStatus
WITH SCHEMABINDING
AS
SELECT
    EngagementServiceCode,
    EngagementStatus,
    COUNT_BIG(*) AS EngagementCount,
    SUM(CAST(ETD_ANSRAmt AS DECIMAL(38,6))) AS ETD_Revenue,
    SUM(CAST(FYTD_ANSRAmt AS DECIMAL(38,6))) AS FYTD_Revenue
FROM stage.DenominatorSnapshot
GROUP BY EngagementServiceCode, EngagementStatus;

CREATE UNIQUE CLUSTERED INDEX IX_DenomAgg_ServiceStatus
ON app.vw_DenominatorAgg_ByServiceCodeStatus (EngagementServiceCode, EngagementStatus);
```

### Pros

| # | Pro | Detail |
|---|-----|--------|
| 1 | **Near-instant denominator results for common patterns** | If a rule matches an indexed view, the denominator count + revenue is pre-computed. The SP only needs to compute numerator matching. |
| 2 | **Full metric output** | Returns complete adoption metrics — same as Option B. |
| 3 | **All benefits of Option B** | RECOMPILE, DBA tuning, encapsulation, caching hooks — all apply. |
| 4 | **Automatic maintenance** | SQL Server maintains indexed views transparently on INSERT/UPDATE/DELETE to the base table. |

### Cons

| # | Con | Detail |
|---|-----|--------|
| 1 | **All cons of Option B apply** | Heavy SP testing, deployment coupling, debugging opacity, full logic duplication. |
| 2 | **Indexed view limitations** | SQL Server indexed views require `SCHEMABINDING`, `COUNT_BIG(*)`, no outer joins, no subqueries, no `UNION`. Very restrictive. |
| 3 | **Combinatorial explosion** | At 200+ apps with diverse rule patterns, you'd need indexed views for many dimension combinations. Maintaining 10+ indexed views adds schema complexity. |
| 4 | **Write penalty** | Every `INSERT` into `stage.DenominatorSnapshot` (weekly load of 50K–500K rows) must update all indexed views. Bulk loads become slower. |
| 5 | **Partial coverage** | Complex predicates (LIKE, NOT IN, date ranges, revenue thresholds) can't be pre-aggregated. SP still needs dynamic SQL fallback for most real-world rule sets. Numerator matching never uses indexed views. |
| 6 | **Highest complexity** | Most complex to implement, maintain, and reason about. Requires understanding of indexed view internals. |
| 7 | **Testing compounded** | Even harder to test than Option B — need to verify view matching logic, fallback behavior, numerator matching, and correctness across all paths. |

### Scale Rating

| Scale | Fit |
|-------|-----|
| 5 apps, 50K rows | ❌ Over-engineered — adds complexity without benefit |
| 20–50 apps, 200K rows | ⚠️ Marginal benefit — most queries won't match indexed views; numerator matching still required |
| 100–200+ apps, 500K+ rows | ⚠️ Partial benefit — only accelerates denominator step for apps whose rules align with view dimensions |

### Performance / Benefit Assessment

| Aspect | Rating | Detail |
|--------|--------|--------|
| **Development cost** | 🔴 Very High | All of Option B + indexed view design, creation, maintenance |
| **Time to deliver** | 🔴 4–5 sprints | Complex SP + indexed views + full integration testing + migration coordination |
| **Metric accuracy** | 🟡 At risk | Same as B — separate code path from pipeline SPs must stay in sync |
| **User value** | 🟢 High | Full before/after comparison; fastest for matching view patterns |
| **Ongoing maintenance** | 🔴 Very High | Parallel pipeline logic + indexed view schema management + bulk load impact |

---

## Option D: Staged Rules Table + Existing Pipeline SP Reuse

**Description**: Instead of writing a new stored procedure, create a `stage.DenominatorFilterRulesPreview` table for transient "proposed" rules and modify `usp_ExecutePipelineRun` (and its internal call to `usp_BuildFilteredDenominator`) to accept an optional `@previewSessionId` parameter. When provided, the pipeline reads proposed denominator rules from the staging table (scoped by session) instead of the committed `app.DenominatorFilterRules`, executes the full metrics calculation (denominator filtering → numerator matching → adoption/revenue computation), and returns the complete metric result set. The run is tagged as a preview (`TriggerSource = 'Preview'`) so it can be distinguished from production runs and optionally excluded from historical reporting.

### How It Works

```
Client POST /api/filters/denominator/:appId/preview
  → Zod validates request body
  → DenominatorFilterService.previewRules()
    → Generates SessionId (GUID)
    → INSERT proposed rules into stage.DenominatorFilterRulesPreview (session-scoped)
    → Creates PipelineRun record (TriggerSource = 'Preview')
    → EXEC usp_ExecutePipelineRun @runId, @applicationId, 'Preview', @actorUserId, @previewSessionId
      → Step 1: Mark run as Processing
      → Step 2: Snapshot rules (staged rules captured as-is into FilterRuleSnapshots)
      → Step 3: Create #FilteredDenom temp table
      → Step 4: EXEC usp_BuildFilteredDenominator @runId, @appId, @previewSessionId
        → SP detects @previewSessionId IS NOT NULL
        → SP reads rules from stage.DenominatorFilterRulesPreview WHERE SessionId = @previewSessionId
          (same JOIN to app.DenominatorModels for column resolution)
        → SP builds dynamic SQL (same logic as production path)
        → SP executes with OPTION (RECOMPILE)
        → Populates #FilteredDenom
      → Step 5–6: Resolve adoption level, parse numerator from stage.EngagementUsageRaw
      → Step 7–8: Validate numerator against filtered denominator, apply numerator filters
      → Step 9: Build matched records (numerator ∩ denominator)
      → Step 10: EXEC usp_CalculateMetrics → adoption %, revenue share %, counts
      → Step 11: Finalize run as Completed
    → DELETE FROM stage.DenominatorFilterRulesPreview WHERE SessionId = @sessionId
    → Read MetricSnapshots for @runId → full preview metrics
  → Service computes delta (current metrics vs. preview metrics)
  → Returns DenominatorPreviewResult { adoptionPct, revenuePct, matchedCount, denominatorCount, delta }
```

### Staging Table Schema

```sql
CREATE TABLE stage.DenominatorFilterRulesPreview (
    PreviewId          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    SessionId          UNIQUEIDENTIFIER NOT NULL,  -- scopes rules to a single preview request
    ApplicationId      UNIQUEIDENTIFIER NOT NULL,
    DenominatorModelId UNIQUEIDENTIFIER NOT NULL,
    Operator           NVARCHAR(32) NOT NULL,
    Value              NVARCHAR(512) NOT NULL,
    RuleOrder          INT NOT NULL,
    CreateDate         DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    ExpiresAt          DATETIME2 NOT NULL DEFAULT DATEADD(HOUR, 1, SYSUTCDATETIME()),
    CONSTRAINT FK_DenomPreview_DenominatorModels
        FOREIGN KEY (DenominatorModelId) REFERENCES app.DenominatorModels(DenominatorModelId),
    CONSTRAINT CK_DenomPreview_Operator CHECK (Operator IN (
        'EQUALS', 'NOT_EQUALS', 'CONTAINS', 'NOT_CONTAINS', 'IN_LIST', 'NOT_IN_LIST',
        'GREATER_THAN', 'GREATER_OR_EQUAL', 'LESS_THAN', 'LESS_OR_EQUAL'
    ))
);

CREATE NONCLUSTERED INDEX IX_DenomPreview_Session
    ON stage.DenominatorFilterRulesPreview (SessionId, ApplicationId)
    INCLUDE (DenominatorModelId, Operator, Value, RuleOrder);

CREATE NONCLUSTERED INDEX IX_DenomPreview_Expiry
    ON stage.DenominatorFilterRulesPreview (ExpiresAt);
```

### SP Modifications (conceptual diff)

**`usp_ExecutePipelineRun`** — add optional parameter, pass through to child SP:

```sql
ALTER PROCEDURE app.usp_ExecutePipelineRun
    @runId UNIQUEIDENTIFIER,
    @applicationId UNIQUEIDENTIFIER,
    @triggerSource NVARCHAR(64),
    @actorUserId NVARCHAR(128),
    @previewSessionId UNIQUEIDENTIFIER = NULL   -- NEW
AS
...
-- Step 4: pass @previewSessionId to BuildFilteredDenominator
EXEC app.usp_BuildFilteredDenominator
    @runId = @runId,
    @applicationId = @applicationId,
    @previewSessionId = @previewSessionId,      -- NEW
    @filteredCount = @filteredCount OUTPUT;
...
-- All other steps (numerator parse, validation, matching, metrics) unchanged
```

**`usp_BuildFilteredDenominator`** — add optional parameter, branch rule source:

```sql
ALTER PROCEDURE app.usp_BuildFilteredDenominator
    @runId UNIQUEIDENTIFIER,
    @applicationId UNIQUEIDENTIFIER,
    @previewSessionId UNIQUEIDENTIFIER = NULL,   -- NEW: when non-NULL, read staged rules
    @filteredCount INT OUTPUT
AS
...
IF @previewSessionId IS NOT NULL
BEGIN
    INSERT INTO #DenominatorRules (...)
    SELECT p.RuleOrder, dm.SourceColumn, dm.FieldType, p.Operator, p.Value
    FROM stage.DenominatorFilterRulesPreview p
    INNER JOIN app.DenominatorModels dm ON dm.DenominatorModelId = p.DenominatorModelId
    WHERE p.SessionId = @previewSessionId
      AND p.ApplicationId = @applicationId
    ORDER BY p.RuleOrder;
END
ELSE
BEGIN
    -- existing logic: read from app.DenominatorFilterRules WHERE IsActive = 1
    ...
END
-- All downstream dynamic SQL generation remains unchanged
```

### Pros

| # | Pro | Detail |
|---|-----|--------|
| 1 | **Full metrics preview** | Returns the same output as a real pipeline run: adoption %, revenue share %, matched count, denominator count. Users see exact impact, not just a row count. |
| 2 | **Reuses entire pipeline** | All SPs (`usp_BuildFilteredDenominator`, `usp_ApplyNumeratorFilters`, `usp_CalculateMetrics`) execute exactly as production — no logic duplication. |
| 3 | **Minimal SP changes** | `usp_ExecutePipelineRun` gains one pass-through parameter. `usp_BuildFilteredDenominator` gains one `IF/ELSE` branch (~15 lines). All other SPs unchanged. |
| 4 | **Preview/pipeline parity guaranteed** | Preview runs the identical code path as a real run. Results are guaranteed to match what committing the rules and triggering a pipeline would produce. |
| 5 | **Concurrency-safe** | `SessionId` scopes each preview to a single user request. Multiple users previewing simultaneously don't collide. |
| 6 | **Auditable** | Preview runs are persisted in `app.PipelineRuns` (with `TriggerSource = 'Preview'`) and `app.MetricSnapshots` — enabling before/after comparison UX. |
| 7 | **Pipeline path unaffected** | `@previewSessionId = NULL` (default) preserves all existing behavior — zero regression risk to production pipeline. |
| 8 | **DBA-optimizable** | Same benefit as Option B — DBA can add indexes, plan guides, or hints without app changes. |

### Cons

| # | Con | Detail |
|---|-----|--------|
| 1 | **Full pipeline execution cost** | Preview runs the entire pipeline (numerator parse, validation, matching, metrics), not just a denominator count. At 50K+ numerator rows, this may take 5–15s. |
| 2 | **Writes persistent artifacts** | Preview creates real rows in `PipelineRuns`, `ValidationResults`, `MatchedRecords`, and `MetricSnapshots`. Need a cleanup strategy or retention policy for preview-tagged runs. |
| 3 | **Staged data cleanup** | Orphaned rows in `stage.DenominatorFilterRulesPreview` if the API call fails between INSERT and DELETE. Mitigated by `ExpiresAt` TTL column + scheduled cleanup job. |
| 4 | **SP modification risk** | Altering two production SPs introduces regression potential. Mitigated by `@previewSessionId = NULL` default — existing callers pass nothing and get unchanged behavior. |
| 5 | **Partial SP testing gap** | The new `IF` branch in `usp_BuildFilteredDenominator` is net-new code. However, it's structurally identical to the existing branch — same columns, same join, same output shape. |
| 6 | **Migration required** | New staging table + ALTER to two existing SPs = coordinated database migration deployment. |
| 7 | **Preview data pollution** | `MetricSnapshots` and `MatchedRecords` tables accumulate preview data. Queries that read "latest metrics" must filter by `TriggerSource != 'Preview'` (or use a dedicated `IsPreview` flag). |

### Mitigations for Cons

| Con | Mitigation |
|-----|-----------|
| Full pipeline cost | SSE streaming response holds connection open 3–8s; result pushed instantly on completion; no separate polling. In ADF mode, server-side polling inside the SSE stream. |
| Persistent artifacts | Add `IsPreview BIT` column to `PipelineRuns`; add retention job to purge preview runs older than 24h |
| Staged data cleanup | `ExpiresAt` column + SQL Agent job: `DELETE FROM stage.DenominatorFilterRulesPreview WHERE ExpiresAt < SYSUTCDATETIME()` |
| Preview data pollution | Dashboard queries already filter by `TriggerSource`; add covering index on `(ApplicationId, TriggerSource)` |

### Scale Rating

| Scale | Fit |
|-------|-----|
| 5 apps, 50K rows | ✅ Excellent — full pipeline completes in < 5s |
| 20–50 apps, 200K rows | ✅ Good — same performance as a real pipeline run |
| 100–200+ apps, 500K+ rows | ⚠️ Acceptable — preview latency mirrors pipeline latency; may need async execution with polling |

### Performance / Benefit Assessment

| Aspect | Rating | Detail |
|--------|--------|--------|
| **Development cost** | 🟢 Low | ~15 lines new SQL in `usp_BuildFilteredDenominator` + 1 pass-through param in `usp_ExecutePipelineRun` + 1 staging table migration |
| **Time to deliver** | 🟢 1 sprint | Staging table migration + minor SP ALTER + TS service layer for INSERT/EXEC/DELETE flow |
| **Metric accuracy** | 🟢 Guaranteed | Same pipeline code path — results are definitionally identical to production runs |
| **User value** | 🟢 High | Full before/after comparison with all metrics; auditable preview runs |
| **Ongoing maintenance** | 🟢 Low | No parallel logic — when pipeline SPs evolve, preview automatically inherits changes |

### Key Differentiator from Option B

Option B re-implements the **entire pipeline logic** (denominator filter + numerator match + metric calc) in a brand-new SP — requiring hundreds of lines of untested T-SQL and creating two parallel implementations that must stay in sync. Option D **runs the full existing pipeline** with a single branching parameter, meaning:

- Complete metric output (adoption %, revenue %, matched count) — not just filtered denominator count
- Zero logic duplication — all 4 existing SPs are reused as-is
- Only ~15 lines of new SQL code in `usp_BuildFilteredDenominator` + 1 pass-through parameter in `usp_ExecutePipelineRun`
- The testing burden is "verify the staged rules produce the same `#DenominatorRules` shape" — the rest of the pipeline is already production-proven

---

## Side-by-Side Comparison

| Criterion | Option A (TS Full Metrics) | Option B (New Full SP) | Option C (SP + Indexed Views) | Option D (Staged Rules + Pipeline) |
|-----------|:---:|:---:|:---:|:---:|
| **Code change effort** | 🟡 Medium (new TS logic) | 🔴 High (new SP ~300+ lines) | 🔴 Very High | 🟢 Low (~15 lines SQL + staging table) |
| **Testability (TS layer)** | 🟢 Pure function testing | 🟢 Thin pass-through | 🟢 Thin pass-through | 🟢 Thin pass-through |
| **Testability (SQL layer)** | 🟢 None needed | 🔴 Full SP untested | 🔴 SP + view logic untested | 🟡 Minimal new SQL (~15 lines) |
| **Deployment simplicity** | 🟢 App deploy only | 🟡 App + migration | 🔴 App + migration + views | 🟡 App + migration |
| **Performance (5 apps, 50K rows)** | 🟡 < 3s (multi-query) | 🟢 < 3s (single call) | 🟢 < 2s | 🟡 < 5s (full pipeline) |
| **Performance (200 apps, 500K rows)** | 🔴 Unviable (memory + queries) | 🟢 Stable (RECOMPILE) | 🟢 Best (for matching patterns) | 🟡 Mirrors pipeline latency |
| **Plan cache hygiene** | 🔴 Pollutes (multiple queries) | 🟢 Clean (RECOMPILE) | 🟢 Clean | 🟢 Clean (RECOMPILE) |
| **Metric completeness** | 🟢 Full metrics | 🟢 Full metrics | 🟢 Full metrics | 🟢 Full metrics |
| **Current/projected comparison** | 🟢 Yes | 🟢 Yes | 🟢 Yes | 🟢 Yes |
| **Preview/pipeline parity** | 🔴 Separate logic — drift risk | 🔴 Separate SP — drift risk | 🔴 Separate SP — drift risk | 🟢 Same pipeline, same SPs |
| **DBA independence** | 🔴 Requires app changes | 🟢 DBA can tune SP | 🟢 DBA can tune SP + views | 🟢 DBA can tune existing SPs |
| **Fits "no SP testing" constraint** | 🟢 Yes | 🔴 No | 🔴 No | 🟡 Mostly — reuses tested logic |
| **Ongoing maintenance** | 🔴 Dual logic sync required | 🔴 Dual logic sync required | 🔴 Triple-layer sync | 🟢 Auto-inherits pipeline changes |

### Performance / Benefit Impact Summary

| Aspect | Option A | Option B | Option C | Option D |
|--------|----------|----------|----------|----------|
| **Estimated preview latency (5 apps)** | 2–3s | 1–3s | 1–2s | 3–5s |
| **Estimated preview latency (200 apps)** | 10–30s ❌ | 3–8s | 2–5s | 5–15s |
| **Development effort** | 2–3 sprints | 3–4 sprints | 4–5 sprints | 1 sprint |
| **Lines of new code** | ~400 TS | ~500 T-SQL | ~700 T-SQL | ~15 T-SQL + ~50 TS |
| **Logic duplication** | Full (TS mirrors SP) | Full (new SP mirrors pipeline) | Full + views | None |
| **Risk of result drift** | 🔴 High | 🔴 High | 🔴 High | 🟢 None (same code path) |
| **Maintenance cost (annual)** | 🔴 High — sync on every pipeline change | 🔴 High — sync on every pipeline change | 🔴 Very High | 🟢 Low — changes auto-propagate |

---

## Recommendation

### Winner: **Option D** (Staged Rules + Existing Pipeline)

Given the requirement for **full adoption metrics with current/projected comparison**, Option D is the clear winner across all constraints:

1. **Meets the requirement immediately** — returns adoption %, revenue share %, matched count, denominator count with current/projected delta and warnings.
2. **Zero logic duplication** — reuses the entire production pipeline (all 4 SPs); preview results are guaranteed identical to production.
3. **Lowest development cost** — ~15 lines of new SQL + 1 staging table + thin TS orchestration layer. Delivers in 1 sprint.
4. **No drift risk** — when pipeline SPs evolve (new operators, metric formulas, dedup logic), the preview automatically inherits all changes.
5. **Acceptable for "no SP testing" constraint** — no new SP logic to test; only a rule-source branch in an already-validated SP.

### Why Not the Others?

| Option | Reason to Reject |
|--------|-----------------|
| **A** | Full metrics requires reimplementing numerator matching + metric calculation in TypeScript (~400 lines of duplicate logic). Creates permanent drift risk against pipeline SPs. Degrades badly at scale with multiple unoptimized queries. |
| **B** | Full metrics requires a new SP that reimplements the entire pipeline (~500 lines T-SQL). Violates "no SP testing" constraint. Creates same drift risk as Option A. |
| **C** | All downsides of B, plus indexed view complexity. Indexed views only accelerate the denominator step — numerator matching and metric calc still need full SP logic. Worst effort-to-benefit ratio. |

### Mitigation for Option D's Pipeline Execution Cost

Since Option D runs the full pipeline (which takes longer than a simple aggregate query):

| Mitigation | Effort | Impact |
|------------|--------|--------|
| **SSE streaming response** | ~60 lines (single API route) | Non-blocking UX; instant result delivery; no client polling logic; connection held open 3–8s then closed |
| **Reuse existing ADF trigger (fire-and-forget)** | ~5 lines (add `previewSessionId` passthrough) | In ADF mode, server-side polling inside SSE stream; client sees clean event flow |
| `OPTION (RECOMPILE)` on preview path | 1-line hint in SP | Eliminates plan cache issues, optimizes for actual params |
| Preview run retention policy | 1 SQL Agent job | Purge preview-tagged artifacts older than 24h |
| Add covering indexes on `stage.DenominatorSnapshot` | 1 migration | Speeds up the denominator filter step within the pipeline |
| Short-circuit option (denominator-only preview) | SP flag | If user only wants denominator impact, skip numerator steps 5–9 |

**Total new infrastructure required: ZERO.** SSE is native HTTP streaming — no new Azure resources, no new packages, no polling hooks.

---

## Async Execution Strategy — Full Analysis

### Problem

Option D runs the full pipeline (3–15s depending on data volume). This duration is too long for a synchronous HTTP request:
- Browser default fetch timeout: 60s (safe but poor UX)
- User perceives > 1s as "slow", > 5s as "broken"
- API thread is blocked during the entire SP execution
- At scale (200+ apps, 500K rows), execution may reach 15s — risk of HTTP gateway/load-balancer timeouts (30s configured on App Service)

The preview must be **asynchronous**: return immediately, execute in the background, deliver results when ready.

### Existing Infrastructure Available

The project already has an async pipeline trigger mechanism:

| Component | Location | What It Does |
|-----------|----------|--------------|
| **`PipelineOrchestrationService`** | `src/frontend/core/application/services/pipelineOrchestrationService.ts` | Creates `PipelineRun` record, resolves execution mode (ADF vs Local), triggers fire-and-forget |
| **`ADFPipelineClient`** | `src/frontend/infrastructure/clients/ADFPipelineClient.ts` | REST POST to ADF webhook (SSRF-protected). Falls back to local mode if no endpoint configured. |
| **`ValidationPipelineDbRepository.executeLocalPipeline()`** | `src/frontend/infrastructure/persistence/database/ValidationPipelineDbRepository.ts` | Calls `EXEC app.usp_ExecutePipelineRun` directly — local execution path |
| **`GET /api/pipeline/[runId]`** | `src/frontend/app/api/pipeline/[runId]/route.ts` | Returns `PipelineRun` entity (status: Queued → Processing → Completed/Failed) |
| **`GET /api/pipeline/[runId]/metrics`** | `src/frontend/app/api/pipeline/[runId]/metrics/route.ts` | Returns computed metrics for a completed run |

---

### Execution Models Compared

#### Model A: Direct ADF Call from API (Current Pattern)

The API route calls `PipelineOrchestrationService.triggerForApplication()` which posts to the ADF webhook endpoint. ADF picks up the request, runs the SP in its own compute, and updates `PipelineRuns` status on completion.

```
┌──────────┐     ┌────────────────────┐     ┌──────────────┐     ┌───────────────┐
│  Client   │     │  Preview API Route  │     │ ADF Pipeline  │     │  Azure SQL    │
└────┬─────┘     └─────────┬──────────┘     └──────┬───────┘     └───────┬───────┘
     │  POST /preview       │                       │                     │
     │─────────────────────►│                       │                     │
     │                      │  INSERT staged rules  │                     │
     │                      │─────────────────────────────────────────────►
     │                      │  POST ADF webhook     │                     │
     │                      │──────────────────────►│                     │
     │  202 { previewRunId }│                       │                     │
     │◄─────────────────────│                       │                     │
     │                      │                       │  EXEC usp_Execute...│
     │                      │                       │────────────────────►│
     │                      │                       │  (3–15s)            │
     │                      │                       │◄────────────────────│
     │                      │                       │  Update PipelineRun │
     │                      │                       │────────────────────►│
```

#### Model B: Direct Local Execution from API (fire-and-forget)

When `PIPELINE_EXECUTION_MODE=local` (or no ADF endpoint configured), the API fires the SP as a detached `Promise` (no await) in the same Node.js process. The SP runs on its own SQL connection while the API returns immediately.

```
┌──────────┐     ┌────────────────────┐     ┌───────────────┐
│  Client   │     │  Preview API Route  │     │  Azure SQL    │
└────┬─────┘     └─────────┬──────────┘     └───────┬───────┘
     │  POST /preview       │                        │
     │─────────────────────►│                        │
     │                      │  INSERT staged rules   │
     │                      │───────────────────────►│
     │                      │  void executeLocal()   │
     │                      │──── (fire-and-forget)──►  EXEC usp_Execute...
     │  202 { previewRunId }│                        │  (3–15s, non-blocking)
     │◄─────────────────────│                        │
```

#### Model C: Background Worker (Azure Function / Separate Process)

The API enqueues a message (Azure Storage Queue or Service Bus); a separate Azure Function or worker process picks it up, runs the SP, and updates the PipelineRun status.

```
┌──────────┐     ┌────────────────────┐     ┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│  Client   │     │  Preview API Route  │     │ Azure Queue  │     │ Worker/Func  │     │  Azure SQL    │
└────┬─────┘     └─────────┬──────────┘     └──────┬──────┘     └──────┬───────┘     └───────┬───────┘
     │  POST /preview       │                       │                   │                     │
     │─────────────────────►│                       │                   │                     │
     │                      │  INSERT staged rules  │                   │                     │
     │                      │────────────────────────────────────────────────────────────────►│
     │                      │  Enqueue message      │                   │                     │
     │                      │──────────────────────►│                   │                     │
     │  202 { previewRunId }│                       │                   │                     │
     │◄─────────────────────│                       │  Dequeue          │                     │
     │                      │                       │──────────────────►│                     │
     │                      │                       │                   │  EXEC usp_Execute...│
     │                      │                       │                   │────────────────────►│
     │                      │                       │                   │  (3–15s)            │
     │                      │                       │                   │◄────────────────────│
```

---

### Background Worker vs. Direct ADF Call — Deep Comparison

| Aspect | Direct ADF Call (Model A) | Background Worker (Model C) | Winner |
|--------|:---:|:---:|:---:|
| **Existing infrastructure** | ✅ Already built — `ADFPipelineClient`, ADF pipeline, webhook | ❌ Must provision Queue + Function App | ADF |
| **Deployment units** | 0 new (reuses existing ADF) | +1 Azure Function or +1 WebJob | ADF |
| **Reliability (retry)** | ✅ ADF has built-in retry policies, timeout config, activity-level retries | ✅ Queue-triggered Functions have automatic retry + dead-letter | Tie |
| **Observability** | ✅ ADF Monitor UI shows run history, duration, errors, activity logs | ⚠️ Must configure App Insights / Function monitoring separately | ADF |
| **Compute isolation** | ✅ ADF activity runs on ADF-managed compute — web app resources unaffected | ✅ Function runs on separate compute — web app resources unaffected | Tie |
| **Cold start** | ⚠️ ADF webhook-triggered pipelines have ~2–5s cold start (pipeline instantiation) | ⚠️ Consumption Function cold start: ~3–8s; Premium plan: ~0.5s | Tie |
| **Cost at low volume** | ✅ ADF pipeline runs are cheap (< $0.01/run at MVP scale) | ⚠️ Function App minimum cost: $0/mo (Consumption) but adds billing complexity | ADF |
| **Cost at high volume** | ⚠️ ADF activity runs: $1/1000 pipeline activities + data movement fees | ✅ Function: $0.20/M executions + compute; cheaper for high-volume short tasks | Worker |
| **Latency to start execution** | ⚠️ 2–5s (ADF pipeline instantiation + activity scheduling) | ✅ < 1s (queue message → trigger → execute) on Premium plan | Worker |
| **Testability** | ⚠️ Hard to test ADF pipeline locally — requires deployed ADF resource | ✅ Function can run locally with `func start` + queue emulator | Worker |
| **Error feedback loop** | ⚠️ ADF errors visible in Monitor portal; must propagate to PipelineRuns table | ✅ Function can directly update PipelineRuns status + write detailed error | Worker |
| **Decoupling from web process** | ✅ Fully decoupled — ADF is independent compute | ✅ Fully decoupled — Function is independent compute | Tie |
| **In-process execution risk** | N/A (offloaded to ADF) | N/A (offloaded to Function) | Tie |
| **Queue semantics** | ⚠️ No queue — ADF is direct invocation; no backpressure mechanism | ✅ Queue provides backpressure, ordering, dead-letter, visibility timeout | Worker |
| **Concurrency control** | ⚠️ Must implement in application layer (PipelineRun status check) | ✅ Queue + Function concurrency settings (maxConcurrentCalls) control throughput | Worker |
| **Local development** | ⚠️ Requires `PIPELINE_EXECUTION_MODE=local` fallback (already exists) | ✅ Azure Functions Core Tools + Azurite queue emulator | Tie |
| **Maintenance** | ✅ ADF already maintained by team; pipeline JSON in repo | ⚠️ New deployment artifact (Function App); new CI/CD pipeline step | ADF |
| **Scaling** | ⚠️ ADF integration runtime has concurrency limits (default: 50 concurrent) | ✅ Functions scale automatically (Consumption/Premium); no concurrency ceiling | Worker |

### Verdict: Background Worker vs. Direct ADF

**For MVP (5 apps, < 20 users)**: Direct ADF call wins. The infrastructure already exists, is monitored, tested, and maintained. Adding a worker introduces a new deployment artifact, new monitoring, and new testing surface for zero measurable benefit at this scale.

**For scale (50+ apps, 100+ concurrent previews)**: Background worker wins. Queue semantics provide backpressure, dead-letter handling, and concurrency control that ADF webhook calls don't offer. If previews start competing with production ADF pipeline runs for integration runtime concurrency, a dedicated worker avoids that contention entirely.

**Key differentiator**: The ADF approach already has a built-in **local fallback** (`PIPELINE_EXECUTION_MODE=local`) that fires the SP directly from the web process. This covers development and gives a tested path for preview without touching ADF at all. A background worker would need to be built from scratch.

---

### Result Delivery Mechanisms Compared

Once the pipeline completes (via ADF, local fire-and-forget, or background worker), the client needs to know. The options:

#### Option 1: Client Polls Status Endpoint

The client periodically calls `GET /api/pipeline/{runId}` until status = Completed/Failed, then fetches metrics.

```
Client                          Server
  │  POST /preview                │
  │──────────────────────────────►│ → 202 { previewRunId }
  │◄──────────────────────────────│
  │                               │
  │  GET /pipeline/{runId}        │  (every N seconds)
  │──────────────────────────────►│ → { status: "Processing" }
  │◄──────────────────────────────│
  │  GET /pipeline/{runId}        │
  │──────────────────────────────►│ → { status: "Completed" }
  │◄──────────────────────────────│
  │  GET /pipeline/{runId}/metrics│
  │──────────────────────────────►│ → { adoptionPct, ... }
  │◄──────────────────────────────│
```

#### Option 2: Server-Sent Events (SSE)

The POST response is a streaming `text/event-stream` connection. The server holds the connection open, executes the pipeline (or monitors it), and pushes the result directly down the same response when ready.

```
Client                          Server
  │  POST /preview                │
  │──────────────────────────────►│ → 200 Content-Type: text/event-stream
  │                               │   (connection held open)
  │◄──── event: status            │   data: { "stage": "processing" }
  │                               │
  │◄──── event: complete          │   data: { current: {...}, projected: {...}, delta: {...} }
  │                               │   (connection closed)
```

**Next.js implementation** — SSE works natively with API routes via `ReadableStream`:
```typescript
// POST /api/filters/denominator/:appId/preview
export async function POST(request: Request): Promise<Response> {
  // validate, insert staged rules, create run...

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      
      // Send "processing" event immediately
      controller.enqueue(encoder.encode(`event: status\ndata: {"stage":"processing"}\n\n`));

      // Execute pipeline (await SP completion)
      await repository.executeLocalPipeline({ runId, applicationId, triggerSource: "Preview", actorUserId, previewSessionId });

      // Fetch result metrics
      const metrics = await metricsService.getRunMetricsSummary(session, runId);
      const current = await metricsService.getLatestNonPreviewMetrics(applicationId);

      // Send complete event with full payload
      controller.enqueue(encoder.encode(`event: complete\ndata: ${JSON.stringify({ current, projected: metrics, delta: computeDelta(current, metrics) })}\n\n`));
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    }
  });
}
```

#### Option 3: SignalR (WebSocket)

Client connects to a SignalR hub. After POST /preview, the server pushes the result via the hub when the pipeline completes.

```
Client                          Server                          SignalR Hub
  │  Connect WebSocket            │                               │
  │───────────────────────────────────────────────────────────────►
  │  POST /preview                │                               │
  │──────────────────────────────►│ → 202 { previewRunId }        │
  │◄──────────────────────────────│                               │
  │                               │  (pipeline executes...)       │
  │                               │  Push result to hub           │
  │                               │──────────────────────────────►│
  │◄── previewComplete event ─────────────────────────────────────│
```

---

### Result Delivery — Full Comparison

| Aspect | Polling | SSE | SignalR |
|--------|:---:|:---:|:---:|
| **New Azure resources** | 0 | 0 | 1 (Azure SignalR Service) |
| **New npm packages** | 0 | 0 | 1 (`@microsoft/signalr`) |
| **Protocol** | HTTP GET (standard) | HTTP streaming (standard) | WebSocket (requires upgrade) |
| **Connection model** | Short-lived per request | Long-lived (held open until result) | Persistent WebSocket |
| **Direction** | Client → Server (pull) | Server → Client (push, unidirectional) | Bidirectional |
| **Latency to receive result** | ≤ poll interval (e.g., 2s) | Instant (streamed on same connection) | Instant (pushed via WS) |
| **Server resource cost** | Low (stateless GETs) | Medium (1 open connection per preview, held 3–15s) | Medium (persistent WS per user) |
| **Browser support** | Universal | Universal (`EventSource` or `fetch` streaming) | Universal (with fallback to long-poll) |
| **Next.js App Router support** | ✅ Native (standard GET routes) | ✅ Native (`ReadableStream` response) | ⚠️ Requires custom server or separate hub endpoint |
| **Load balancer / proxy compatibility** | ✅ Standard HTTP | ⚠️ Some proxies buffer chunked responses; must set `X-Accel-Buffering: no` | ⚠️ WebSocket upgrade requires ALB/proxy config |
| **Handles client disconnect** | Graceful (next poll just doesn't happen) | Graceful (stream aborted; pipeline still runs) | Graceful (reconnection protocol) |
| **Multiple tabs** | Each tab polls independently | Each tab opens its own SSE stream | Shared via connection groups |
| **Complexity** | Lowest — reuses existing endpoints | Low — single streaming route | High — hub setup, connection management, groups |
| **Existing precedent in codebase** | ✅ Yes (production pipeline trigger uses this) | ❌ No (but trivial to add) | ❌ No |
| **Testing** | 0 new tests (existing endpoints tested) | ~5 tests (stream parsing, error handling) | ~20 tests (hub lifecycle, reconnection, groups) |
| **Deployment impact** | None | None | Azure SignalR resource + infra-as-code |
| **Observability** | Easy (each GET logged independently) | Medium (streaming response; log at start/end) | Complex (WS connection lifecycle + message tracing) |

---

### SSE Deep Dive — Why It's the Best Fit for Preview

SSE (Server-Sent Events) is a compelling middle ground:

**Advantages over polling:**
- **Instant delivery** — result arrives the moment the pipeline completes (no 2s delay)
- **Single connection** — one HTTP request, one response stream (no repeated GETs)
- **Progress events** — can push intermediate status ("filtering denominator...", "matching numerator...") without separate endpoints
- **Self-contained** — the preview lifecycle (request → progress → result) lives in a single HTTP transaction

**Advantages over SignalR:**
- **Zero infrastructure** — no Azure SignalR Service, no hub endpoint, no WebSocket upgrade
- **Zero new packages** — built on standard HTTP streaming; `ReadableStream` is native in Next.js
- **Trivial to test** — it's just an HTTP response with `text/event-stream` content type
- **No connection management** — connection lives only for the duration of the preview (3–15s), then closes
- **No reconnection logic** — if the stream drops, user clicks "Preview" again (acceptable for a 3–8s operation)

**When SSE is NOT appropriate (and SignalR is):**
- Long-lived connections (minutes/hours) where reconnection matters
- Bidirectional communication (server needs to receive from client mid-stream)
- Broadcast to multiple clients simultaneously
- Complex connection grouping / routing

None of these apply to preview — it's a short, single-user, unidirectional operation.

#### SSE Event Schema

```
event: status
data: {"stage": "queued", "pctComplete": 0}

event: status
data: {"stage": "filtering_denominator", "pctComplete": 25}

event: status
data: {"stage": "matching_numerator", "pctComplete": 50}

event: status
data: {"stage": "calculating_metrics", "pctComplete": 75}

event: complete
data: {"current": {...}, "projected": {...}, "delta": {...}, "warnings": [...], "previewRunId": "..."}

event: error
data: {"message": "Pipeline execution failed: timeout exceeded", "previewRunId": "..."}
```

#### SSE + ADF Compatibility

When using ADF execution mode (not local), the SSE endpoint can't directly await the SP. Instead it polls the PipelineRun status internally (server-side polling, not client-side):

```typescript
// SSE route — ADF mode
const stream = new ReadableStream({
  async start(controller) {
    const encoder = new TextEncoder();
    controller.enqueue(encoder.encode(`event: status\ndata: {"stage":"queued"}\n\n`));

    // Trigger ADF pipeline
    await adfClient.triggerValidationPipeline({ runId, applicationId, triggerSource: "Preview", actorUserId, previewSessionId });

    // Server-side polling until completion
    let run: PipelineRun;
    do {
      await new Promise(resolve => setTimeout(resolve, 1000));
      run = await repository.getRunById(runId);
      controller.enqueue(encoder.encode(`event: status\ndata: {"stage":"${run.status.toLowerCase()}"}\n\n`));
    } while (run.status === "Queued" || run.status === "Processing");

    if (run.status === "Completed") {
      const metrics = await metricsService.getRunMetricsSummary(session, runId);
      controller.enqueue(encoder.encode(`event: complete\ndata: ${JSON.stringify(metrics)}\n\n`));
    } else {
      controller.enqueue(encoder.encode(`event: error\ndata: {"message":"${run.errorMessage}"}\n\n`));
    }
    controller.close();
  }
});
```

This moves the polling loop from client to server — the client just listens for events on a single open connection.

#### SSE + Local Mode

In local execution mode, the SSE endpoint directly awaits the SP and can send progress events at natural breakpoints:

```typescript
// SSE route — Local mode (ideal)
const stream = new ReadableStream({
  async start(controller) {
    const encoder = new TextEncoder();
    controller.enqueue(encoder.encode(`event: status\ndata: {"stage":"processing"}\n\n`));

    // Execute SP synchronously (awaited) — connection stays open during execution
    await repository.executeLocalPipeline({ runId, applicationId, triggerSource: "Preview", actorUserId, previewSessionId });

    // SP done — fetch results and send
    const metrics = await metricsService.getRunMetricsSummary(session, runId);
    const current = await metricsService.getLatestNonPreviewMetrics(applicationId);
    const result = { current, projected: metrics, delta: computeDelta(current, metrics), previewRunId: runId };
    controller.enqueue(encoder.encode(`event: complete\ndata: ${JSON.stringify(result)}\n\n`));
    controller.close();
  }
});
```

In local mode there's no polling at all — the connection simply stays open while the SP executes (3–8s), then the result is streamed and the connection closes.

---

### Direct ADF Call vs. Background Worker — When Each Wins

| Scenario | Direct ADF Call | Background Worker | Reasoning |
|----------|:---:|:---:|-----------|
| **MVP (5 apps, 50K rows, < 20 users)** | ✅ | ❌ Over-engineered | ADF infra exists; no queue/worker to build, deploy, or monitor |
| **Production (20+ apps, daily use)** | ✅ | ⚠️ Optional | ADF still handles load fine; worker only needed if ADF concurrency becomes a bottleneck |
| **High scale (50+ concurrent previews)** | ⚠️ | ✅ | ADF integration runtime has concurrency limits; queue provides backpressure |
| **Preview competes with production ADF runs** | ⚠️ Contention risk | ✅ | Dedicated worker isolates preview compute from production pipeline scheduling |
| **Need dead-letter / retry semantics** | ⚠️ ADF retries are pipeline-level | ✅ | Queue dead-letter handles poison messages; Function retries are message-level |
| **Local development / testing** | ✅ (local mode fallback) | ✅ (Azurite + func start) | Both have local paths; ADF fallback is already built |
| **Cost sensitivity** | ✅ (< $0.01/run) | ⚠️ (Function App overhead) | At low volume, ADF per-run cost is negligible |
| **Latency sensitivity** | ⚠️ (2–5s ADF cold start) | ✅ (< 1s queue-to-execute) | Worker starts executing faster after trigger |
| **Team expertise** | ✅ (ADF already in use) | ⚠️ (new Function App expertise) | Prefer what the team already knows |

### Key Insight: ADF vs Worker Is Configurable, Not Architectural

The existing `PipelineOrchestrationService` already abstracts execution mode behind `resolveExecutionMode()`. Adding a third mode ("worker") is trivial — the architecture doesn't change:

```typescript
type PipelineExecutionMode = "adf" | "local" | "worker";  // future: add "worker"
```

The decision between ADF and worker is a **deployment configuration choice**, not an application architecture choice. The preview API route, the service layer, and the SP modifications are identical regardless of which executor runs the pipeline. This can be changed later without touching application code.

---

### Recommended Strategy

| Layer | Decision | Rationale |
|-------|----------|-----------|
| **Trigger mechanism** | Reuse existing `PipelineOrchestrationService` (ADF in prod, local in dev) | Already built, tested, monitored. Zero new infrastructure. |
| **Result delivery** | **SSE** (`text/event-stream` response from preview endpoint) | Instant result delivery; single connection lifecycle; zero new packages; native Next.js support; no client-side polling logic |
| **Execution in ADF mode** | Server-side polling inside SSE stream until run completes | Moves polling from client to server; client sees clean event stream |
| **Execution in local mode** | Direct await of SP inside SSE stream | Simplest path; connection held open 3–8s; result streamed immediately |
| **Background worker** | Not now — defer until ADF concurrency becomes a measured bottleneck | Adds deployment complexity for zero benefit at < 20 users |

### Preview API Route — Final Shape

```typescript
// POST /api/filters/denominator/:appId/preview
// Returns: text/event-stream (SSE)
// Events: status → complete | error

export async function POST(request: Request, context: { params: Promise<{ appId: string }> }): Promise<Response> {
  // 1. Auth + validation
  const session = await requireActive(request, repositories);
  const { appId } = await context.params;
  const body = await request.json();
  const parsed = previewRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "VALIDATION_ERROR" }, { status: 400 });

  // 2. Stage rules + create run
  const sessionId = randomUUID();
  const runId = randomUUID();
  await repository.insertStagedRules(sessionId, appId, parsed.data.rules);
  await pipelineRepository.createRun({ runId, applicationId: appId, triggerSource: "Preview", actorUserId: session.userId });

  // 3. Return SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

      try {
        send("status", { stage: "processing", previewRunId: runId });

        const executionMode = resolveExecutionMode();
        if (executionMode === "local") {
          // Direct execution — await SP
          await pipelineRepository.executeLocalPipeline({ runId, applicationId: appId, triggerSource: "Preview", actorUserId: session.userId, previewSessionId: sessionId });
        } else {
          // ADF mode — trigger + server-side poll
          await adfClient.triggerValidationPipeline({ runId, applicationId: appId, triggerSource: "Preview", actorUserId: session.userId, previewSessionId: sessionId });
          await waitForRunCompletion(pipelineRepository, runId, (stage) => send("status", { stage }));
        }

        // 4. Fetch results
        const projected = await metricsService.getRunMetricsSummary(session, runId);
        const current = await metricsService.getLatestNonPreviewMetrics(appId);
        const delta = computeDelta(current, projected);
        const warnings = generateWarnings(current, projected);

        send("complete", { current, projected, delta, warnings, previewRunId: runId });
      } catch (error) {
        send("error", { message: error instanceof Error ? error.message : "Preview failed", previewRunId: runId });
      } finally {
        // 5. Cleanup staged rules
        await repository.deleteStagedRules(sessionId).catch(() => {});
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no" }
  });
}
```

### SSE Client-Side Consumption (Conceptual)

The client uses the standard `EventSource` API or `fetch` with streaming response:

```
1. fetch(POST /preview, { body: rules })   → ReadableStream
2. Listen for `status` events              → Update UI loading state
3. Listen for `complete` event             → Render current/projected comparison
4. Listen for `error` event                → Show retry prompt
5. Connection closes automatically         → Done
```

No polling hooks, no interval management, no status endpoint calls. The entire preview lifecycle is a single HTTP transaction.

---

### What Changes vs. What Is Reused (Updated for SSE)

| Component | Change Required | Effort |
|-----------|----------------|--------|
| `PipelineOrchestrationService` | Extend `TriggerPipelineInput.triggerSource` union to include `"Preview"`. Add optional `previewSessionId?: string`. | ~5 lines |
| `TriggerPipelineInput` DTO | Add `"Preview"` to union, add optional `previewSessionId` field | ~2 lines |
| `ADFPipelineClient.triggerValidationPipeline()` | Include `previewSessionId` in JSON body | ~1 line |
| `ValidationPipelineDbRepository.executeLocalPipeline()` | Pass `@previewSessionId` param to SP | ~3 lines |
| `GET /api/pipeline/[runId]` route | No change — still available for ad-hoc status checks if needed | 0 lines |
| `GET /api/pipeline/[runId]/metrics` route | No change — still available for metrics retrieval if needed | 0 lines |
| **NEW: `POST /api/filters/denominator/:appId/preview`** | SSE endpoint: INSERT staged rules → trigger pipeline → stream events → cleanup | ~60 lines |

### ADF Pipeline Compatibility

The ADF pipeline `PL_MetricsProcessing` parameters must be extended:

```json
{
  "name": "PL_MetricsProcessing",
  "properties": {
    "parameters": {
      "runId": { "type": "string" },
      "applicationId": { "type": "string" },
      "triggerSource": { "type": "string" },
      "actorUserId": { "type": "string" },
      "previewSessionId": { "type": "string", "defaultValue": "" }
    }
  }
}
```

The SP activity passes `@previewSessionId = NULLIF(@pipeline().parameters.previewSessionId, '')`.

### Minimal Code Changes to Existing Files

**`src/frontend/core/application/dto/pipeline/PipelineTriggerDto.ts`**:
```typescript
export interface TriggerPipelineInput {
  runId: string;
  applicationId: string;
  triggerSource: "API" | "ADF" | "Manual" | "Preview";  // ← add "Preview"
  actorUserId: string;
  previewSessionId?: string;  // ← add optional field
}
```

**`src/frontend/infrastructure/persistence/database/ValidationPipelineDbRepository.ts`** — extend SP call:
```typescript
async executeLocalPipeline(input: CreatePipelineRunInput): Promise<void> {
  await this.sqlClient.query(
    `EXEC app.usp_ExecutePipelineRun
       @runId = @runId,
       @applicationId = @applicationId,
       @triggerSource = @triggerSource,
       @actorUserId = @actorUserId,
       @previewSessionId = @previewSessionId;`,
    {
      runId: input.runId,
      applicationId: input.applicationId,
      triggerSource: input.triggerSource,
      actorUserId: input.actorUserId,
      previewSessionId: input.previewSessionId ?? null
    }
  );
}
```

**`src/frontend/infrastructure/clients/ADFPipelineClient.ts`** — include in JSON body:
```typescript
body: JSON.stringify({
  applicationId: input.applicationId,
  runId: input.runId,
  triggerSource: input.triggerSource,
  actorUserId: input.actorUserId,
  previewSessionId: input.previewSessionId ?? null
})
```

---

### Concurrency: No Guard for Preview

The existing `POST /api/pipeline/run` has a concurrency guard for **production** runs:
```typescript
if (latestRun && (latestRun.status === "Queued" || latestRun.status === "Processing")) {
  throw new AppError(409, "CONFLICT", "A pipeline run is already in progress for this application.");
}
```

**Preview runs intentionally skip this guard.** Reasons:

1. **Previews don't affect real values** — each preview is session-scoped (`SessionId` in staged rules), tagged `TriggerSource = 'Preview'`, and excluded from dashboard metrics queries. Two concurrent previews for the same app operate on independent data paths.

2. **Stuck runs would block the feature** — if a preview run gets stuck in "Queued" or "Processing" (SP timeout, ADF failure, crash), a concurrency guard would permanently lock out future previews for that application.

3. **Low blast radius** — worst case, a user fires 2–3 overlapping previews. Each runs in isolation with its own `SessionId`. The only cost is extra SP executions against the database — acceptable at < 20 concurrent users.

4. **Self-cleaning** — the `ExpiresAt` TTL on `stage.DenominatorFilterRulesPreview` ensures orphaned staged rules are purged within 1 hour, and preview `PipelineRuns` rows are cleaned by the 24h retention job.

---

### Stale Run Recovery (Production Pipeline Guard)

The existing production concurrency guard has a critical flaw: **if a run gets stuck in "Queued" or "Processing" (SP timeout, ADF crash, network failure), it permanently blocks all future pipeline runs for that application.**

#### Solution: Time-Based Staleness Check

```typescript
const STALE_RUN_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

const latestRun = (await repository.listRunsByApplication(applicationId, 1))[0] ?? null;

if (latestRun && (latestRun.status === "Queued" || latestRun.status === "Processing")) {
  const runAge = Date.now() - new Date(latestRun.createDate).getTime();

  if (runAge > STALE_RUN_THRESHOLD_MS) {
    await repository.updateRunStatus({
      runId: latestRun.runId,
      status: "Failed",
      actorUserId: "system:stale-recovery",
      endTime: new Date().toISOString(),
      errorMessage: `Auto-failed: run exceeded ${STALE_RUN_THRESHOLD_MS / 60000}min threshold without completing.`
    });
  } else {
    throw new AppError(409, "CONFLICT", "A pipeline run is already in progress for this application.");
  }
}
```

#### Why 30 Minutes?

| Data point | Value |
|-----------|-------|
| Normal pipeline execution (5 apps, 50K rows) | 3–8s |
| Worst case pipeline execution (200 apps, 500K rows) | 15–60s |
| ADF pipeline timeout (configured) | 10 minutes |
| Safety margin | 3× worst case |

#### Defense-in-Depth: SQL Agent Cleanup Job

```sql
-- Run every 15 minutes
UPDATE app.PipelineRuns
SET Status = 'Failed',
    EndTime = SYSUTCDATETIME(),
    ErrorMessage = 'Auto-failed: exceeded 30min execution threshold.',
    UpdatedBy = 'system:stale-cleanup',
    UpdateDate = SYSUTCDATETIME()
WHERE Status IN ('Queued', 'Processing')
  AND CreateDate < DATEADD(MINUTE, -30, SYSUTCDATETIME());
```

#### Implementation Priority

| Component | Scope | Priority |
|-----------|-------|----------|
| Time-based staleness in `POST /api/pipeline/run` route | Fixes the existing production guard | **Must-have (MVP)** |
| SQL Agent cleanup job | Defense-in-depth for app-process crashes | **Should-have (v1.1)** |
| Admin "force cancel" endpoint | Manual override for ops | **Nice-to-have** |

---

### Scale Path

| Phase | Trigger | Execution | Result Delivery |
|-------|---------|-----------|-----------------|
| **MVP** | 5 apps, < 20 users | Direct ADF call or local fire-and-forget (existing) | SSE — single streaming response |
| **Growth** | 20–50 apps, ADF cold starts noticeable | Same (ADF retries handle volume) | Same SSE |
| **Scale** | 50+ concurrent previews, ADF contention | Add background worker (Azure Function + Queue) | Same SSE (worker updates PipelineRun status; SSE polls server-side) |
| **Enterprise** | 100+ concurrent, multi-region | Worker + queue per region | SignalR (only if SSE proxy buffering becomes an issue) |

The architecture evolves **execution backend only** — the client-facing SSE contract never changes.

---

## Decision Record

| Decision | Rationale |
|----------|-----------|
| **Implement Option D** | Only option that delivers full metrics without logic duplication; lowest effort; guaranteed parity |
| **Add `stage.DenominatorFilterRulesPreview` table** | Session-scoped transient rules with TTL cleanup |
| **ALTER `usp_BuildFilteredDenominator`** | Add `@previewSessionId` param with `IF/ELSE` branch (~15 lines) |
| **ALTER `usp_ExecutePipelineRun`** | Add pass-through `@previewSessionId` param |
| **Tag preview runs as `TriggerSource = 'Preview'`** | Enables filtering in dashboard queries + retention policy |
| **Add covering index** (migration 0XX) | Cheap insurance for denominator filter performance |
| **Reuse existing `PipelineOrchestrationService`** | Already supports fire-and-forget execution (ADF + Local modes); no new async infrastructure needed |
| **SSE for result delivery** | Instant result push via native HTTP streaming; zero new packages; zero new Azure resources; single connection lifecycle (open → stream events → close) |
| **Direct ADF call for execution (not background worker)** | ADF infrastructure already exists and is monitored; worker adds deployment complexity for zero benefit at < 20 users; can add worker later if ADF concurrency becomes a bottleneck |
| **No concurrency guard for preview** | Previews are session-isolated and non-destructive; a guard would create a permanent block if a preview run gets stuck |
| **Stale run recovery (30min timeout)** | Production concurrency guard auto-fails runs stuck > 30min; prevents permanent blocking from SP timeouts or ADF crashes |
| **SQL Agent cleanup job (defense-in-depth)** | Catches stuck runs even if the app process crashes before it can run the staleness check |
| **Do NOT build SignalR / Queue / Background Worker** | Over-engineering for 5 apps / < 20 users; SSE + existing ADF trigger is sufficient; add worker only when ADF contention is measured |
| **Do NOT implement Option A, B, or C** | All require reimplementing pipeline logic, creating drift risk and high maintenance |
