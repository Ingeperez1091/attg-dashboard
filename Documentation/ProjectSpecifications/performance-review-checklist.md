# Performance Review and Implementation Checklist

## Scope

Read-only review of the application SQL access layer, SQL tables, and stored procedures used by the test environment dashboard pipeline and runtime dashboard pages.

Files reviewed include:

- `src/frontend/infrastructure/persistence/database/DashboardUsageDbRepository.ts`
- `src/frontend/infrastructure/persistence/database/MetricsDbRepository.ts`
- `src/frontend/infrastructure/persistence/database/ValidationPipelineDbRepository.ts`
- `src/frontend/infrastructure/persistence/database/queries/validation-pipeline-queries.ts`
- `database/stored-procedures/usp_ExecutePipelineRun.sql`
- `database/stored-procedures/usp_ApplyNumeratorFilters.sql`
- `database/stored-procedures/usp_BuildFilteredDenominator.sql`
- `database/stored-procedures/usp_CalculateMetrics.sql`
- `database/schema/app/*.sql`
- `database/schema/stage/*.sql`

## Executive Summary

The slow response profile is dominated by query-shape and scan-pattern problems rather than a single missing index.

The largest risks are:

1. Non-SARGable application filtering in dashboard queries.
2. Repeated cast-based lookups against temp tables during pipeline execution.
3. Combinatorial JSON rule evaluation in numerator filtering.
4. Optional-parameter OR predicates that can produce unstable plans.
5. Latest-row lookups that rely on index shapes that are not fully aligned with the query orderings.

The result is that even when the SQL server is reachable and healthy, the app can still feel slow because the engine is doing unnecessary scans, sorts, and repeated predicate evaluation.

## Analysis

### 1) Dashboard queries cast indexed GUIDs to strings

**Where**

- `src/frontend/infrastructure/persistence/database/DashboardUsageDbRepository.ts`

**Pattern**

- `CAST(ms.ApplicationId AS NVARCHAR(36)) IN (...)`
- `CAST(pr.ApplicationId AS NVARCHAR(36)) IN (...)`

**Why it matters**

Casting the indexed GUID column in the predicate prevents the optimizer from using the most direct seek pattern on `ApplicationId`. The query has to compensate for a CSV-based filter list, which also adds string splitting overhead.

**Likely effect**

- Higher logical reads
- More expensive plans as application count increases
- Increased latency on dashboard and run-context endpoints

### 2) Pipeline run processing repeatedly probes temp data with casts

**Where**

- `database/stored-procedures/usp_ExecutePipelineRun.sql`

**Pattern**

- Multiple `NOT EXISTS` checks against `#FilteredDenom`
- Repeated `CAST(fd.ClientID AS NVARCHAR(256))` and `CAST(fd.EngagementID AS NVARCHAR(256))`

**Why it matters**

The temp table is built once, but it is then searched many times with casted expressions. That makes it harder to exploit efficient lookups and multiplies the cost across several validation and matching steps.

**Likely effect**

- CPU spikes during pipeline execution
- Longer run time for medium and large denominator sets
- More time spent in the validation and matching phases than necessary

### 3) Numerator filter logic expands records × rules × JSON payloads

**Where**

- `database/stored-procedures/usp_ApplyNumeratorFilters.sql`

**Pattern**

- `OPENJSON(...)`
- `CROSS JOIN #NumeratorRules nr`
- Multiple `JSON_VALUE(...)`, `TRY_CONVERT(...)`, `STRING_SPLIT(...)`, and string normalization calls

**Why it matters**

This is the most computationally expensive shape in the pipeline. Every valid numerator record is evaluated against every active rule, and each comparison may invoke JSON parsing or conversion logic. That scales poorly as payload size and rule count increase.

**Likely effect**

- High CPU consumption
- Runtime growth that is multiplicative rather than linear
- Sensitivity to rule count, payload size, and JSON shape

### 4) Optional-parameter predicates can produce unstable plans

**Where**

- `src/frontend/infrastructure/persistence/database/MetricsDbRepository.ts`
- `database/stored-procedures/usp_ExecutePipelineRun.sql`
- `database/stored-procedures/usp_ApplyNumeratorFilters.sql`
- `src/frontend/infrastructure/persistence/database/queries/validation-pipeline-queries.ts`

**Pattern**

- `(@runId IS NULL OR Column = @runId)`
- `(@status IS NULL OR Status = @status)`

**Why it matters**

These patterns are convenient, but they can lead to parameter-sensitive plans. A plan that is acceptable for one execution shape may be poor for another, especially when the query can be invoked with and without filters.

**Likely effect**

- Latency variance between calls
- Unpredictable plan quality under different filter combinations

### 5) Latest-row lookups are not fully aligned to the current index shapes

**Where**

- `database/stored-procedures/usp_ExecutePipelineRun.sql`
- `database/stored-procedures/usp_ApplyNumeratorFilters.sql`
- `database/schema/stage/EngagementUsageRaw.sql`
- `database/schema/app/MetricSnapshots.sql`

**Pattern**

- `TOP 1 ... ORDER BY CreateDate DESC`
- `TOP 1 ... ORDER BY CalculationDate DESC, CreateDate DESC`

**Why it matters**

The code frequently asks for the newest row for a given application or run. The current indexes help, but they do not always align to the exact ordering requirements, so SQL may still sort or scan more data than necessary.

**Likely effect**

- Extra sort work
- Slower latest-row retrieval
- Avoidable cost on dashboard summary queries

### 6) Matched-record upserts are done row by row

**Where**

- `src/frontend/infrastructure/persistence/database/queries/validation-pipeline-queries.ts`

**Pattern**

- `for (const item of items)`
- `MERGE app.MatchedRecords ...` inside the loop

**Why it matters**

The implementation is deterministic, but it issues one upsert per item. That is acceptable for small batches, but it scales poorly if the matched set grows.

**Likely effect**

- More round-trips to SQL
- More transaction overhead
- Slower large-run finalization

## Proposed Remediation

### Phase 1: Fastest wins

1. Refactor dashboard query filtering to avoid casting `ApplicationId` to text.
2. Add a composite helper index for latest-row lookups on stage and metric tables.
3. Introduce an indexing strategy for temp-table lookups used during pipeline execution.

### Phase 2: Pipeline hot-path optimization

4. Reduce cast-heavy lookups against `#FilteredDenom` by materializing the key shape needed for joins.
5. Rework numerator filter evaluation to reduce repeated JSON parsing and rule expansion cost.

### Phase 3: Query-shape stability

6. Split optional-parameter queries into explicit query shapes for filtered and unfiltered paths.
7. Review whether the row-by-row matched-record upsert can be converted to a set-based approach.

## Execution Plan

| Priority | Work Item | Effort | Primary Touch Points | Expected Gain |
|---|---|---:|---|---|
| 1 | Remove string-cast application filtering | Medium | `src/frontend/infrastructure/persistence/database/DashboardUsageDbRepository.ts` | Faster dashboard load and run-context queries |
| 2 | Add temp-table lookup support | Low-Medium | `database/stored-procedures/usp_ExecutePipelineRun.sql` | Lower pipeline CPU and reads |
| 3 | Align latest-row indexes | Low | `database/schema/stage/EngagementUsageRaw.sql`, `database/schema/app/MetricSnapshots.sql` | Faster TOP 1 / latest-row lookups |
| 4 | Reduce numerator filter cost | High | `database/stored-procedures/usp_ApplyNumeratorFilters.sql` | Largest pipeline runtime reduction |
| 5 | Split optional-parameter query shapes | Medium | `src/frontend/infrastructure/persistence/database/MetricsDbRepository.ts`, `src/frontend/infrastructure/persistence/database/queries/validation-pipeline-queries.ts` | More stable query plans |
| 6 | Batch matched-record upserts | Medium-High | `src/frontend/infrastructure/persistence/database/queries/validation-pipeline-queries.ts` | Faster finalization for larger runs |

## Recommended Work Breakdown

### Step 1: Dashboard query filter cleanup

Goal: remove `CAST(ApplicationId AS NVARCHAR(...))` from dashboard filtering paths.

Touch points:

- `src/frontend/infrastructure/persistence/database/DashboardUsageDbRepository.ts`

Suggested approach:

- Replace CSV-string matching with typed parameters where possible.
- If multiple application IDs must be supported, pass them in a structured form that preserves GUID comparisons.
- Keep the repository API stable.

Validation:

- Compare query plans before and after.
- Measure dashboard page load latency for 1, 5, and 20 application IDs.

### Step 2: Temp-table lookup support in pipeline execution

Goal: make repeated exact-match checks against `#FilteredDenom` cheaper.

Touch points:

- `database/stored-procedures/usp_ExecutePipelineRun.sql`

Suggested approach:

- Materialize the comparison key once in `#FilteredDenom`.
- Add a temp-table index or primary key on the lookup key used by validation and match steps.
- Remove repeated casts in `NOT EXISTS` and join predicates.

Validation:

- Measure `usp_ExecutePipelineRun` duration and logical reads.
- Compare validation/match sections separately, if possible.

### Step 3: Latest-row index alignment

Goal: support the most common `TOP 1 ... ORDER BY ... DESC` query shapes.

Touch points:

- `database/schema/stage/EngagementUsageRaw.sql`
- `database/schema/app/MetricSnapshots.sql`

Suggested approach:

- Review whether composite indexes should include both the filter key and the sort columns.
- Favor index keys that match the query predicate plus the descending order.

Validation:

- Confirm the optimizer chooses seeks + ordered access rather than scans + sorts.
- Measure latest-snapshot and latest-stage lookup latency.

### Step 4: Numerator filter optimization

Goal: reduce the cost of record-by-rule evaluation.

Touch points:

- `database/stored-procedures/usp_ApplyNumeratorFilters.sql`

Suggested approach:

- Pre-normalize JSON paths or common comparisons where possible.
- Avoid repeated `JSON_VALUE` and conversion calls for the same field within a single rule evaluation.
- Consider whether any rules can be pushed into a more selective preprocessing step.

Validation:

- Benchmark with representative payload sizes and rule counts.
- Track CPU and elapsed time, not just row counts.

### Step 5: Split optional-parameter query shapes

Goal: avoid unstable plans from `OR`-based optional filters.

Touch points:

- `src/frontend/infrastructure/persistence/database/MetricsDbRepository.ts`
- `src/frontend/infrastructure/persistence/database/queries/validation-pipeline-queries.ts`

Suggested approach:

- Use dedicated query statements for filtered vs unfiltered code paths.
- Keep the SQL simpler so the optimizer can produce more specific plans.

Validation:

- Compare null vs non-null filter cases.
- Check whether plan variance decreases.

### Step 6: Batch matched-record writes

Goal: reduce round-trips and statement overhead during finalization.

Touch points:

- `src/frontend/infrastructure/persistence/database/queries/validation-pipeline-queries.ts`

Suggested approach:

- Replace row-by-row `MERGE` with a set-based batch where practical.
- Preserve deterministic behavior for reruns.

Validation:

- Compare finalization time for small and larger match sets.
- Verify rerun idempotency still holds.

## Implementation Checklist

### Dashboard query layer

- [ ] Replace CSV/string-cast application filters with typed predicates.
- [ ] Confirm the resulting query still supports the existing repository API.
- [ ] Benchmark dashboard usage and run-context queries with 1, 5, and 20 application IDs.

### Pipeline execution stored procedures

- [ ] Add a key structure to `#FilteredDenom` that supports efficient exact-match lookups.
- [ ] Remove repeated `CAST(...)` predicates from denominator existence checks where possible.
- [ ] Test `usp_ExecutePipelineRun` end-to-end with a realistic denominator load.

### Numerator filtering

- [ ] Measure the cost of `OPENJSON` + `CROSS JOIN #NumeratorRules` on a realistic payload sample.
- [ ] Identify whether common rule types can be short-circuited or pre-normalized.
- [ ] Validate that rule evaluation remains functionally identical after any optimization.

### Query-shape stability

- [ ] Split optional-parameter query paths into separate statements where plan quality matters.
- [ ] Compare logical reads and elapsed time for null and non-null filter cases.

### Supporting indexes

- [ ] Review whether the latest-row lookup queries need composite indexes that include the exact sort columns.
- [ ] Recheck execution plans for dashboard summary, latest snapshot, and pipeline run history queries.

### Batch operations

- [ ] Evaluate whether matched-record upserts can be batched instead of merged row by row.
- [ ] Confirm any batching still preserves deterministic rerun behavior.

## Validation Plan

Use the test environment to capture before/after measurements:

1. SQL elapsed time for dashboard page load queries.
2. Logical reads for `usp_ExecutePipelineRun`.
3. Logical reads and duration for numerator filter application.
4. CPU/elapsed time on latest snapshot and run-summary queries.

For each change, compare:

- estimated vs actual execution plan
- logical reads
- elapsed time
- CPU time

## Suggested Delivery Order

1. Latest-row index alignment.
2. Temp-table lookup support.
3. Dashboard query filter cleanup.
4. Optional-parameter query split.
5. Numerator filter optimization.
6. Batched matched-record writes.

This order favors the lowest-effort/highest-certainty wins first, then moves to the more invasive pipeline work.

## Notes

- No code or SQL changes were made in this review.
- The review assumes the database is intentionally small/free-tier in the test environment, so even moderate inefficiencies are amplified.
- The highest-value fixes are the ones that remove scans and repeated casts first.