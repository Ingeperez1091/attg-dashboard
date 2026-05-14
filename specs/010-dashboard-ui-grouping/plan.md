# Implementation Plan: Dashboard UI and Sub Service Line Grouping (EPIC-BQM-014)

**Branch**: `010-dashboard-ui-grouping` | **Date**: 2026-05-07 | **Spec**: `specs/010-dashboard-ui-grouping/spec.md`
**Input**: Feature specification from `specs/010-dashboard-ui-grouping/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Deliver the Application Usage dashboard presentation slice for EPIC-BQM-014 by implementing the required hero/KPI/filter/grouped-detail/footer layout, Sub Service Line grouping hierarchy, role-scoped visibility behavior, and resilient UI state handling (empty/in-progress/error). The implementation will consume persisted metric snapshots and pipeline status from existing APIs/services, preserve Clean Architecture boundaries (thin routes/components, orchestration in `core/application`, contracts in `core/domain`, persistence in `infrastructure`), and enforce accessibility/responsive baseline requirements defined in stakeholder and architecture documentation.

## Technical Context

**Language/Version**: TypeScript 5.x, Next.js App Router (frontend + API routes), SQL-backed metric persistence context from existing epics  
**Primary Dependencies**: Next.js, React, Motif web components, existing auth/session guards, existing metrics retrieval services/repositories, Zod validation, `mssql` bindings in data adapters  
**Storage**: Azure SQL Database (read-only consumption for this epic via existing metric snapshot and run-status paths)  
**Testing**: Vitest unit/contract/integration suites, Playwright end-to-end coverage for shipped user journeys, route/service tests for RBAC and state behavior, CI lint/type-check/tests  
**Target Platform**: Web dashboard (desktop + mobile responsive) hosted in existing Next.js runtime  
**Project Type**: Web application feature slice (UI + API retrieval orchestration)  
**Performance Goals**: Dashboard initial load under 3 seconds for authorized standard scope; filter interactions under 500ms where cached/pre-aggregated data is available  
**Constraints**: No new KPI calculation logic in UI layer; use persisted snapshots only; enforce role/application scoping server-side; preserve existing clean architecture boundaries; accessibility baseline required (keyboard + reduced motion)  
**Scale/Scope**: Five in-scope applications (Maestro, EYST, Prodigy, Vector, Navigate), grouped by Sub Service Line at portfolio/group/application levels

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Requirement (constitution.md) | Assessment | Status |
|------|-------------------------------|------------|--------|
| Principle I - Data Integrity First | Reproducible, auditable metrics display | Feature consumes persisted snapshots and run lineage only; no client-side recalculation introduced. | ✅ PASS |
| Principle II - Configuration-Driven Business Rules | Config-driven behavior, no hardcoded rule logic | UI consumes configuration-governed metric outputs and scope constraints from existing services. | ✅ PASS |
| Principle III - Validated Data Ingestion | Display depends on validated pipeline outputs | Dashboard reads pipeline-produced snapshots and statuses from governed tables/APIs. | ✅ PASS |
| Principle IV - Test-First Deterministic Isolation | Deterministic tests across unit/contract/integration | Plan includes deterministic RBAC/state/grouping tests with in-memory repository mode. | ✅ PASS |
| Principle V - Security & RBAC | Strict role/application scoping | Server-side API/service scoping is mandatory for all dashboard responses. | ✅ PASS |
| Principle VI - Incremental Delivery | Independently deployable vertical slice | Epic scope limited to UI grouping/presentation and state behavior; excludes advanced trend controls. | ✅ PASS |
| Principle VII - Clean Architecture | Maintain layer boundaries, no duplication | Routes/components remain thin; orchestration in `core/application`; adapters in `infrastructure`. | ✅ PASS |
| CI/Quality Gates | Lint, type-check, tests must pass | Plan preserves existing CI gate requirements and validation evidence. | ✅ PASS |

**Pre-Design Gate Result: ✅ PASS.**

## Project Structure

### Documentation (this feature)

```text
specs/010-dashboard-ui-grouping/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── dashboard-ui-grouping-contract.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)
```text
src/
└── frontend/
    ├── app/
    │   ├── dashboard/
    │   │   └── page.tsx
    │   └── api/
    │       ├── dashboard/
    │       │   └── usage/
    │       │       ├── route.ts
    │       │       └── state/route.ts
    │       ├── metrics/
    │       │   ├── [appId]/route.ts
    │       │   └── history/[appId]/route.ts
    │       └── pipeline/[runId]/metrics/route.ts
    ├── components/
    │   └── dashboard/
    ├── core/
    │   ├── application/
    │   │   ├── dto/
    │   │   └── services/
    │   └── domain/
    │       ├── entities/
    │       ├── repositories/
    │       └── value-objects/
    ├── infrastructure/
    │   └── persistence/
    │       ├── database/
    │       ├── memory/
    │       └── runtime/
    └── lib/
        ├── auth/
        ├── validation/
        └── types/

tests/
├── unit/
│   └── frontend/
├── contract/
│   └── metrics/
├── integration/
│   └── metrics/
└── e2e/
    └── dashboard/
```

**Structure Decision**: Use the existing Next.js web-application structure in `src/frontend` and preserve Clean Architecture boundaries mandated by the constitution and project-structure spec. UI composition lives under app/components, orchestration/services under `core/application`, contracts under `core/domain`, and data access adapters under `infrastructure/persistence`.

## Phase 0: Research Summary

Resolved in `research.md`:

| Decision Area | Chosen Approach | Resolved |
|---------------|-----------------|----------|
| Dashboard composition contract | Implement fixed five-section layout from architecture contract | YES |
| Grouping strategy | Server-returned records grouped by Sub Service Line with portfolio/group/application hierarchy | YES |
| UI state handling | Explicit empty, in-progress, error states with stable layout preservation | YES |
| RBAC enforcement boundary | Enforce scope in API/service layer; never rely on client-only filtering | YES |
| Accessibility/responsive baseline | Keyboard navigable controls + reduced-motion behavior + mobile readability | YES |

## Phase 1: Design Outputs

- `data-model.md` defines dashboard presentation/view-model entities and validation rules for grouping/scope/state.
- `contracts/dashboard-ui-grouping-contract.md` defines API/UI interaction and response contracts for grouped dashboard retrieval.
- `quickstart.md` defines implementation and verification steps including deterministic RBAC and state tests.

## Task-Ready Aggregation Blueprint

This section maps directly to future `/speckit.tasks` decomposition.

1. Route-layer contract task
- Implement `GET /api/dashboard/usage` with Zod query validation for `subServiceLine` and `runId`.
- Return canonical envelope defined in `contracts/dashboard-ui-grouping-contract.md`.

2. Security-first scope task
- Resolve principal session and role.
- Resolve authorized `applicationIds` before querying snapshot data.
- Reject unauthorized run/application access with 403.

3. Service aggregation task
- Add application service that loads persisted snapshot rows for scoped apps.
- Aggregate to hierarchy: portfolio -> Sub Service Line -> application.
- Build KPI cards from persisted values only (no recomputation).

4. State derivation task
- Build deterministic state resolver for `ready`, `empty`, `inProgress`, `error`.
- Include run-context hydration for recalculation indicator.

5. Frontend composition task
- Render sections from envelope without mutating KPI values.
- Apply presentation-only filtering (collapse/sort/highlight) to server-scoped groups.

6. Security and quality verification task
- Add contract/integration tests for RBAC scope leakage, invalid query handling, and state transitions.
- Add tests asserting percentages are returned within [0, 100] and envelope shape is stable.
- Add Playwright end-to-end tests for shipped dashboard journeys.
- Add performance verification task for SC-001 (dashboard load under 3 seconds).

## Post-Design Constitution Check

| Gate | Status | Notes |
|------|--------|-------|
| Principle I - Data Integrity First | ✅ PASS | Design renders immutable snapshot values and freshness metadata without recalculation drift. |
| Principle II - Configuration-Driven Business Rules | ✅ PASS | UI behavior remains driven by existing app/rule/adoption configuration and retrieved metadata. |
| Principle III - Validated Data Ingestion | ✅ PASS | Display contract depends on validated pipeline outputs and run status context. |
| Principle IV - Test-First Deterministic Isolation | ✅ PASS | Quickstart includes deterministic tests for grouping hierarchy, state handling, and RBAC visibility. |
| Principle V - Security & RBAC | ✅ PASS | Contracts require server-side authorization checks for all dashboard data paths. |
| Principle VI - Incremental Delivery | ✅ PASS | Scope stays within dashboard UI grouping baseline; advanced trend controls remain out of scope. |
| Principle VII - Clean Architecture | ✅ PASS | Responsibilities are partitioned by layer with no duplicated domain contracts. |

**Post-Design Gate Result: ✅ PASS.**

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
