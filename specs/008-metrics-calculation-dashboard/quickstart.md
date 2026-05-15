# Quickstart: Metrics Calculation Dashboard (EPIC-BQM-007)
**Feature Branch**: `008-metrics-calculation-dashboard`  
**Date**: 2026-05-07

## Purpose

Implement and verify KPI calculation, immutable snapshot persistence, and interim synthetic investment support for non-production workflows.

## Prerequisites

1. Current branch is `008-metrics-calculation-dashboard`.
2. Local database and app runtime configuration are available.
3. Existing validated pipeline flow (EPIC-BQM-006) is runnable for test datasets.

## Implementation Sequence

1. Finalize domain and application contracts
- Define/confirm KPI calculation service inputs/outputs.
- Ensure run lifecycle contract prevents `Completed` before snapshot write.

2. Implement KPI calculation behavior
- Apply adoption-level and revenue-basis settings per application.
- Add On Target Rate and Average Engagement calculations with threshold/aggregation policy input.
- Implement divide-by-zero-safe behavior.

3. Implement snapshot persistence and traceability
- Persist immutable records to `app.MetricSnapshots`.
- Persist/associate rule context via `app.FilterRuleSnapshots`.
- Persist metric-definition metadata fields.

4. Implement interim synthetic investment support
- Add deterministic idempotent seed operation for synthetic investment facts.
- Ensure `IsSynthetic = 1` marking and non-authoritative labeling semantics.

5. Implement retrieval and scope enforcement
- Ensure retrieval path is role/application scoped.
- Ensure synthetic investment values are exposed only in non-production contexts.

## Verification Steps

1. Formula correctness verification
- Run benchmark dataset and verify Adoption/Revenue/OnTarget/AvgEngagement outputs meet expected values.

2. Lifecycle verification
- Confirm run status transitions to `Completed` only after snapshot persistence success.
- Confirm failure path does not create partial snapshot artifacts.

3. Traceability verification
- Confirm each snapshot includes run id, calculation timestamp, and metadata versioning fields.
- Confirm rule-context snapshot linkage is queryable.

4. Idempotency verification
- Run synthetic investment seeding twice for same scope/date and verify no duplicates.

5. Security/scope verification
- Validate admin vs non-admin metric retrieval outputs by assigned application scope.
- Validate synthetic investment values are clearly labeled non-authoritative.

## Test Strategy

- Unit tests:
  - KPI formula logic
  - divide-by-zero handling
  - metadata mapping
- Contract tests:
  - snapshot persistence shape
  - retrieval payload semantics
- Integration tests:
  - end-to-end run: validated input -> calculation -> snapshot persistence -> query retrieval
  - synthetic seed idempotency and labeling

## Completion Criteria

- All Success Criteria in `spec.md` are met.
- Constitution and architecture gate checks remain PASS.
- No unresolved clarifications remain.

## Operational Runbook Notes

1. Run trigger guidance
- Use API-triggered runs after numerator ingestion for near-real-time refresh.
- Use scheduled ADF-triggered runs for baseline periodic recalculation.
- Do not trigger runs from filter-rule save operations; rule edits are configuration changes, not data events.

2. Recalculation policy
- Recalculation must execute as a new pipeline run with a new `RunId`.
- A run can persist at most one metric snapshot; duplicate inserts for the same `RunId` are rejected.

3. Failure triage sequence
- Check `app.PipelineRuns` by `RunId` for `Status`, `StartTime`, `EndTime`, and summary counts.
- If status is `Failed`, review SQL error output from `usp_ExecutePipelineRun`/`usp_CalculateMetrics`.
- Verify that no partial `app.MetricSnapshots` row exists for failed runs.

4. Synthetic investment governance
- Synthetic investment rows (`IsSynthetic = 1`) are non-authoritative.
- Synthetic context is exposed only in non-production contexts when explicitly requested.

## Query Examples

1. Latest snapshot for an application (API)

```http
GET /api/metrics/{appId}
```

2. Latest snapshot with synthetic context (non-production only)

```http
GET /api/metrics/{appId}?includeSynthetic=true
```

3. Run-scoped summary

```http
GET /api/pipeline/{runId}/metrics
```

4. Historical snapshots with paging

```http
GET /api/metrics/history/{appId}?from=2026-05-01T00:00:00.000Z&to=2026-05-31T23:59:59.999Z&page=1&pageSize=20
```

5. Recent snapshot lineage inspection (SQL)

```sql
SELECT TOP (20)
  SnapshotId,
  RunId,
  ApplicationId,
  CalculationDate,
  MetricDefinitionVersion,
  SourceBatchId,
  FilterRuleSnapshotId,
  RefreshTimestamp
FROM app.MetricSnapshots
WHERE ApplicationId = @ApplicationId
ORDER BY CalculationDate DESC, CreateDate DESC;
```

6. Synthetic investment inspection (SQL)

```sql
SELECT
  InvestmentId,
  ApplicationId,
  CalculationDate,
  InvestmentAmount,
  IsSynthetic,
  SyntheticBusinessKey,
  SourceBatchId
FROM app.InvestmentDummyFacts
WHERE ApplicationId = @ApplicationId
ORDER BY CalculationDate DESC, CreateDate DESC;
```
