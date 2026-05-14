# Implementation Plan: Validation Processing Pipeline (EPIC-BQM-006)

**Branch**: `007-validation-processing-pipeline` | **Date**: 2026-04-016 | **Spec**: `specs/007-validation-processing-pipeline/spec.md`
**Input**: Feature specification from `specs/007-validation-processing-pipeline/spec.md`

## Summary

Implement the Extended-MVP validation and processing slice as a single per-application asynchronous workflow that operates only on the local denominator snapshot (`stage.DenominatorSnapshot` / `app.vw_DenominatorLocal`): it snapshots active rules, builds filtered denominator population, parses and deduplicates staged numerator records, validates IDs, applies numerator filters, matches outcomes, and persists run/record traceability with explicit error context. The technical approach uses T-SQL stored procedures (`usp_ExecutePipelineRun` with `usp_BuildFilteredDenominator` and `usp_ApplyNumeratorFilters`) with dynamic SQL via `sp_executesql`, `JSON_VALUE` + `TRY_CAST`, and `ROW_NUMBER`, orchestrated by ADF in production and direct `mssql` invocation only for local development fallback. The implementation follows Clean Architecture boundaries (application orchestration in services, contracts in domain, adapters in infrastructure), with API routes creating `PipelineRun` records and exposing status/results under role-scoped visibility.

## Technical Context

**Language/Version**: TypeScript 5.x (Next.js app/API), T-SQL (Azure SQL Database), ADF pipeline JSON definitions
**Primary Dependencies**: Next.js App Router API routes, existing auth/session abstractions, Zod validation, `mssql` parameterized SQL bindings, Azure Data Factory orchestration
**Storage**: Azure SQL Database (`stage.EngagementUsageRaw`, `stage.DenominatorSnapshot`, `app.ValidationResults`, `app.MatchedRecords`, `app.PipelineRuns`, `app.FilterRuleSnapshots`)
**Testing**: Vitest unit/contract/integration suites plus CI pipeline checks (lint, type-check, tests)
**Target Platform**: Next.js + Azure SQL + Azure Data Factory in Azure-hosted and local-development contexts
**Project Type**: Web application with API routes and data-processing orchestration
**Performance Goals**: 95% of single-application processing runs up to 100K staged records complete in <=15 minutes; asynchronous execution does not block dashboard sessions
**Constraints**: Local denominator only (no direct external Mercury query during processing), configuration-driven rules only, role-scoped outcome access, deterministic run traceability, parameterized SQL only
**Scale/Scope**: Five applications (Maestro, EYST, Prodigy, Vector, Navigate), one application per processing run, coordinated orchestrator for active applications

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Requirement (constitution.md) | Assessment | Status |
|------|-------------------------------|------------|--------|
| Principle I - Data Integrity First | Traceable, auditable data transformations; preserve staging; explicit coercion behavior | Plan requires run + record persistence, preserved staging source, and explicit parse/coercion rules. | ✅ PASS |
| Principle II - Configuration-Driven Business Rules | Numerator/denominator rules must come from configuration | Plan enforces rule evaluation from existing rule tables and snapshots run-time ruleset. | ✅ PASS |
| Principle III - Validated Data Ingestion | Validate against denominator, reject duplicates, surface errors | Plan includes filtered denominator validation, duplicate detection, and user-visible outcome summaries. | ✅ PASS |
| Principle IV - Test-First Development | Deterministic tests across unit/contract/integration | Plan includes contract and integration test coverage for run outcomes and access scope. | ✅ PASS |
| Principle V - Security & RBAC | AuthZ checks and scoped visibility | Plan requires role and application scoping for trigger/view capabilities. | ✅ PASS |
| Principle VI - Incremental Delivery | Independently deployable feature slice | Scope ends at validated/matched outcomes and run traceability; metric publication remains in EPIC-BQM-007. | ✅ PASS |
| Principle VII - Clean Architecture | Keep route/service/domain/infrastructure boundaries | Plan preserves thin transport adapters and isolated persistence adapters. | ✅ PASS |
| CI Pipeline Gate | Protected-branch required checks | CI baseline exists and remains a release gate for this work. | ✅ PASS |

**Pre-Design Gate Result: ✅ PASS.**

### Post-Design Gate Review

- Principle I - PASS: `data-model.md` and contracts explicitly define immutable staging + auditable run and record outcomes.
- Principle II - PASS: `contracts/processing-workflow-contract.md` requires configuration lookups and rule snapshots per run.
- Principle III - PASS: `quickstart.md` verifies invalid/duplicate/unmatched/error surfacing behavior.
- Principle IV - PASS: quickstart test flow defines deterministic validation scenarios.
- Principle V - PASS: contracts define role/application access scoping for trigger and result visibility.
- Principle VI - PASS: design remains bounded to validation processing and orchestration.
- Principle VII - PASS: project structure assigns orchestration to `core/application` and SQL adapters to `infrastructure/persistence`.

No constitution violations require complexity justification.

## Project Structure

### Documentation (this feature)

```text
specs/007-validation-processing-pipeline/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── processing-workflow-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
└── frontend/
    ├── app/
    │   └── api/
    │       ├── pipeline/
    │       │   ├── run/
    │       │   │   └── route.ts
    │       │   ├── [runId]/
    │       │   │   └── route.ts
    │       │   └── validation-results/
    │       │       └── [appId]/
    │       │           ├── route.ts
    │       │           └── summary/
    │       │               └── route.ts
    ├── core/
    │   ├── application/
    │   │   ├── clients/
    │   │   │   └── IADFPipelineClient.ts
    │   │   └── services/
    │   │       ├── validationPipelineService.ts
    │   │       └── pipelineOrchestrationService.ts
    │   └── domain/
    │       ├── entities/
    │       │   ├── PipelineRun.ts
    │       │   ├── ValidationResult.ts
    │       │   └── MatchedRecord.ts
    │       └── repositories/
    │           └── validationPipelineRepository.ts
    └── infrastructure/
        ├── clients/
        │   └── ADFPipelineClient.ts
        └── persistence/
            ├── database/
            │   ├── ValidationPipelineDbRepository.ts
            │   └── queries/
            │       └── validation-pipeline-queries.ts
            ├── memory/
            │   └── ValidationPipelineMemoryRepository.ts
            └── runtime/
                └── repositories.ts

database/
├── migrations/
├── rollback/
└── schema/

pipelines/
├── denominator-weekly-load/
│   └── pipeline.json
└── numerator-processing/
    └── pipeline.json

tests/
├── contract/
│   └── validation-pipeline/
├── integration/
│   └── validation-pipeline/
└── unit/
```

**Structure Decision**: Keep the existing Next.js/Clean Architecture layout rooted in `src/frontend`. Use API routes only as transport adapters, place processing orchestration in `core/application/services`, keep repository contracts in `core/domain/repositories`, and define external client contracts in `core/application/clients` (e.g., `IADFPipelineClient`). Concrete SQL/memory adapters remain in `infrastructure/persistence`, and concrete external clients (e.g., `ADFPipelineClient`) remain in `infrastructure/clients`. `pipelineOrchestrationService` must depend on `IADFPipelineClient`, not infrastructure implementations. Store pipeline definitions under `pipelines/` and validate behavior with `tests/contract` + `tests/integration`.

## Phase 0: Research Summary

Resolved in `research.md`:

| Decision Area | Chosen Approach | Resolved |
|---------------|-----------------|----------|
| Denominator source boundary | Process only against local denominator snapshot (`stage.DenominatorSnapshot` / `app.vw_DenominatorLocal`) | YES |
| Rule evaluation strategy | Use configuration tables + AND-combined rules + per-run snapshot persistence | YES |
| Run granularity | One application per run with orchestrated fan-out for active apps | YES |
| Validation transparency | Persist per-record reasons and expose role-scoped summaries | YES |
| Pipeline architecture | Stored-procedure-centric processing orchestrated by ADF, no ADF data flow business logic | YES |

## Phase 1: Design Outputs

- `data-model.md` defines entities, attributes, validations, and run state transitions.
- `contracts/processing-workflow-contract.md` defines trigger/result interfaces and validation outcome semantics.
- `quickstart.md` defines implementation order, test sequence, and verification checks aligned to constitution gates.

## Post-Design Constitution Check

| Gate | Status | Notes |
|------|--------|-------|
| Principle I - Data Integrity First | ✅ PASS | Design enforces staging preservation, run traceability, and record-level reason persistence. |
| Principle II - Configuration-Driven Business Rules | ✅ PASS | Rules sourced from active config and captured as run snapshots. |
| Principle III - Validated Data Ingestion | ✅ PASS | Validation, duplicate detection, and unmatched/error surfacing are explicit. |
| Principle IV - Test-First Development | ✅ PASS | Quickstart defines deterministic contract/integration-first workflow. |
| Principle V - Security & RBAC | ✅ PASS | Access controls and scoped visibility are contractual requirements. |
| Principle VI - Incremental Delivery | ✅ PASS | Scope is bounded to processing outcomes; metrics publication deferred. |
| Principle VII - Clean Architecture | ✅ PASS | Layer boundaries and dependency directions remain compliant. |

**Post-Design Gate Result: ✅ PASS.**

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
