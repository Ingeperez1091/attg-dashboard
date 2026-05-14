# Implementation Plan: Metrics Calculation Dashboard (EPIC-BQM-007)

**Branch**: `008-metrics-calculation-dashboard` | **Date**: 2026-05-07 | **Spec**: `specs/008-metrics-calculation-dashboard/spec.md`
**Input**: Feature specification from `specs/008-metrics-calculation-dashboard/spec.md`

## Summary

Extend the validation pipeline (EPIC-BQM-006) by implementing KPI metric calculation as the final orchestration step within the existing `usp_ExecutePipelineRun` stored procedure. EPIC-BQM-007 adds a SQL stored procedure (`usp_CalculateMetrics`) that reads validated matched records and adoption settings, calculates governed KPI values deterministically, and persists immutable snapshots before marking the run `Completed`. This approach ensures KPI calculation remains server-side, non-blocking, and performance-optimized via SQL aggregation. Configuration-driven semantics (adoption level, revenue basis) come from `app.AdoptionSettings`; rule-context traceability is preserved via `app.FilterRuleSnapshots`. Interim non-authoritative investment dummy data (for non-production unblocking) is provided as a separate seeded dataset.

## Technical Context

**Language/Version**: TypeScript 5.x (Next.js app/API for retrieval), T-SQL (Azure SQL Database for calculation and persistence), ADF pipeline JSON definitions  
**Primary Dependencies**: Existing validation pipeline (`usp_ExecutePipelineRun`), Azure SQL Database T-SQL stored procedures (`usp_CalculateMetrics`), Next.js App Router API routes for retrieval, existing auth/session abstractions, Zod validation, `mssql` parameterized SQL bindings, Azure Data Factory orchestration  
**Storage**: Azure SQL Database (`app.MetricSnapshots`, `app.PipelineRuns`, `app.MatchedRecords`, `app.AdoptionSettings`, `app.FilterRuleSnapshots`, interim synthetic investment facts table in `app` schema)  
**SQL Implementation**: T-SQL stored procedures for deterministic KPI calculation within the pipeline orchestration (no application-layer calculation logic)  
**Testing**: Vitest unit/contract/integration suites plus CI checks (lint, type-check, tests); SQL contract tests for calculation formula correctness  
**Target Platform**: Next.js + Azure SQL + Azure Data Factory in Azure-hosted and local-development contexts  
**Project Type**: Web application with API routes and data-processing orchestration  
**Performance Goals**: 95% of metric retrievals for standard application scope return in <=3 seconds; KPI calculation (final pipeline step) completes within overall pipeline 15-minute SLA; asynchronous execution does not block dashboard users  
**Constraints**: Calculation runs within existing pipeline execution context; uses validated matched records only; role-scoped access enforced server-side; no direct external Mercury queries at calculation time; synthetic investment data is non-authoritative and non-production only; parameterized SQL only  
**Scale/Scope**: Five applications (Maestro, EYST, Prodigy, Vector, Navigate), one application per processing run, historical snapshot retention for trend and audit

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Requirement (constitution.md) | Assessment | Status |
|------|-------------------------------|------------|--------|
| Principle I - Data Integrity First | Traceable/auditable transforms and reproducible metrics | Plan persists immutable snapshots with run + metadata lineage and uses validated inputs only. | ✅ PASS |
| Principle II - Configuration-Driven Business Rules | Rules/settings are configurable, not hardcoded | Calculation uses `app.AdoptionSettings` and rule-context snapshots, no hardcoded app-specific formulas. | ✅ PASS |
| Principle III - Validated Data Ingestion | Downstream calculations must rely on validated data paths | Inputs come from prior validated/matched outputs (`app.MatchedRecords`) and run context. | ✅ PASS |
| Principle IV - Test-First Deterministic Isolation | Deterministic unit/contract/integration verification | Plan requires benchmark fixture tests for formulas, metadata persistence, and idempotent seeding. | ✅ PASS |
| Principle V - Security & RBAC | Server-side authorization boundaries | Plan enforces role/application-scope on metric retrieval and interim investment exposure. | ✅ PASS |
| Principle VI - Incremental Delivery | Independently deployable value slice | Scope is bounded to metric calculation/persistence and interim investment support only. | ✅ PASS |
| Principle VII - Clean Architecture | Layer boundaries and no contract duplication | Domain contracts in `core/domain`, orchestration in `core/application`, adapters in `infrastructure`. | ✅ PASS |
| CI/CD and IaC Gates | Existing required quality/deployment governance | Existing CI gates remain mandatory; no gate bypass introduced. | ✅ PASS |

**Pre-Design Gate Result: ✅ PASS.**

## Project Structure

### Documentation (this feature)

```text
specs/008-metrics-calculation-dashboard/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── metrics-calculation-contract.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
└── frontend/
    ├── app/
    │   └── api/
    │       └── metrics/
    │           ├── [appId]/route.ts (GET latest snapshot, role-scoped)
    │           └── history/[appId]/route.ts (GET historical snapshots)
    ├── core/
    │   ├── application/
    │   │   └── services/
    │   │       └── metricsRetrievalService.ts (retrieval orchestration)
    │   └── domain/
    │       ├── entities/
    │       │   └── MetricSnapshot.ts
    │       └── repositories/
    │           └── metricsRepository.ts
    └── infrastructure/
        └── persistence/
            ├── database/
            │   └── MetricsDbRepository.ts
            ├── memory/
            │   └── MetricsMemoryRepository.ts
            └── runtime/
                └── repositories.ts

database/
├── migrations/
│   └── [new] migration for MetricSnapshots, AdoptionSettings, InvestmentDummyFacts
├── schema/
│   └── app/
│       ├── MetricSnapshots.sql (table)
│       ├── AdoptionSettings.sql (table)
│       └── InvestmentDummyFacts.sql (table)
├── stored-procedures/
│   ├── usp_CalculateMetrics.sql (NEW - final metrics calculation step)
│   └── [update] usp_ExecutePipelineRun.sql (integrate usp_CalculateMetrics)
└── seed/

tests/
├── contract/
│   └── metrics/
├── integration/
│   └── metrics/
└── unit/
```

**Structure Decision**: Preserve existing Next.js/Clean Architecture layering. Keep API routes thin for transport and authorization checks, place KPI orchestration and lifecycle rules in `core/application/services`, define domain contracts in `core/domain`, and keep SQL/memory persistence adapters in `infrastructure/persistence` with runtime selection in `infrastructure/persistence/runtime`.

## Phase 0: Research Summary

Resolved in `research.md`:

| Decision Area | Chosen Approach | Resolved |
|---------------|-----------------|----------|
| KPI formula source | Use governed formulas from architecture and EPIC-007 stories | YES |
| Snapshot write semantics | Immutable append-only snapshots with explicit run/metadata lineage | YES |
| Interim investment strategy | Deterministic idempotent synthetic dataset in app schema, non-authoritative | YES |
| Rule-context traceability | Persist filter/adoption context snapshots tied to run id | YES |
| Retrieval scope | Server-side role/application filtering for authorized consumers | YES |

## Phase 1: Design Outputs

- `data-model.md` defines core entities, fields, validations, and lifecycle states.
- `contracts/metrics-calculation-contract.md` defines KPI calculation/persistence and retrieval contracts.
- `quickstart.md` defines implementation and verification sequence with deterministic tests.

## Post-Design Constitution Check

| Gate | Status | Notes |
|------|--------|-------|
| Principle I - Data Integrity First | ✅ PASS | Data model and contract enforce immutable snapshots and full run lineage. |
| Principle II - Configuration-Driven Business Rules | ✅ PASS | Contract requires adoption/revenue basis from settings and threshold policy metadata. |
| Principle III - Validated Data Ingestion | ✅ PASS | Inputs are constrained to validated matched outputs and run-scoped context. |
| Principle IV - Test-First Deterministic Isolation | ✅ PASS | Quickstart requires deterministic benchmark and idempotency verification. |
| Principle V - Security & RBAC | ✅ PASS | Retrieval contract explicitly defines role/application scoped access. |
| Principle VI - Incremental Delivery | ✅ PASS | Scope remains metrics/snapshots/interim dummy data only. |
| Principle VII - Clean Architecture | ✅ PASS | Design keeps orchestration, domain contracts, and persistence adapters isolated. |

**Post-Design Gate Result: ✅ PASS.**

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
