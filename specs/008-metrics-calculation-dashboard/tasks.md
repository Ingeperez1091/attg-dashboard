# Tasks: Metrics Calculation Dashboard (EPIC-BQM-007)

**Input**: Design documents from `/specs/008-metrics-calculation-dashboard/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/metrics-calculation-contract.md`, `quickstart.md`

**Tests**: Test tasks are included because the specification and quickstart explicitly require unit, contract, and integration verification for deterministic KPI behavior.

**Organization**: Tasks are grouped by user story to enable independent implementation and validation.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add feature scaffolding and migration placeholders required by all stories.

- [X] T001 Create migration script for EPIC-007 schema changes in database/migrations/026_metrics_snapshot_and_dummy_facts.sql
- [X] T002 Update migration deployment ordering to include EPIC-007 script in database/migrations/deployment-order.md
- [X] T003 [P] Create SQL stored procedure scaffold for KPI calculation in database/stored-procedures/usp_CalculateMetrics.sql
- [X] T004 [P] Create SQL seed scaffold for synthetic investment facts in database/seed/seed-investment-dummy-facts.sql
- [X] T005 [P] Create domain entity scaffold for metric snapshots in src/frontend/core/domain/entities/MetricSnapshot.ts
- [X] T006 [P] Create repository interface scaffold for metric retrieval in src/frontend/core/domain/repositories/metricsRepository.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement shared infrastructure that all user stories depend on.

**⚠️ CRITICAL**: No user story work starts before this phase is complete.

- [X] T007 Implement app.MetricSnapshots and app.InvestmentDummyFacts DDL in database/migrations/026_metrics_snapshot_and_dummy_facts.sql
- [X] T008 Implement KPI calculation stored procedure contract (input validation, NULLIF guards, transaction-safe errors) in database/stored-procedures/usp_CalculateMetrics.sql
- [X] T009 Integrate Step 7 metrics invocation into pipeline orchestration in database/stored-procedures/usp_ExecutePipelineRun.sql
- [X] T010 [P] Add SQL persistence adapter interface methods for latest/history/run metrics in src/frontend/infrastructure/persistence/database/MetricsDbRepository.ts
- [X] T011 [P] Add deterministic in-memory adapter methods for latest/history/run metrics in src/frontend/infrastructure/persistence/memory/MetricsMemoryRepository.ts
- [X] T012 Wire runtime repository selection for metrics adapters in src/frontend/infrastructure/persistence/runtime/repositories.ts
- [X] T013 [P] Add shared response DTOs and validators for metrics endpoints in src/frontend/core/application/dto/metricsDto.ts
- [X] T014 [P] Add authorization guard helpers for metrics retrieval scope checks in src/frontend/lib/auth/authorization.ts

**Checkpoint**: Foundation ready. User stories can now proceed independently.

---

## Phase 3: User Story 1 - Calculate Core and Expanded KPIs (Priority: P1) 🎯 MVP

**Goal**: Calculate Adoption %, Revenue %, On Target Rate, and Average Engagement deterministically from validated pipeline inputs.

**Independent Test**: Run one processing cycle for one app and verify all four KPI outputs, including divide-by-zero behavior.

### Tests for User Story 1

- [X] T015 [P] [US1] Add SQL contract test for KPI formulas in tests/contract/metrics/metrics-calculation.contract.test.ts
- [X] T016 [P] [US1] Add integration test for run completion gating on snapshot insert in tests/integration/metrics/pipeline-metrics-lifecycle.integration.test.ts
- [X] T017 [P] [US1] Add unit tests for KPI mapping and null/zero handling in tests/unit/frontend/core/application/services/metricsRetrievalService.test.ts

### Implementation for User Story 1

- [X] T018 [US1] Implement governed KPI aggregation logic in database/stored-procedures/usp_CalculateMetrics.sql
- [X] T019 [US1] Implement filter-rule snapshot linkage and metadata mapping in database/stored-procedures/usp_CalculateMetrics.sql
- [X] T020 [US1] Extend pipeline status transition logic to complete only after metric snapshot write in database/stored-procedures/usp_ExecutePipelineRun.sql
- [X] T021 [US1] Implement retrieval orchestration for latest and run-scoped metrics in src/frontend/core/application/services/metricsRetrievalService.ts
- [X] T022 [US1] Implement GET latest snapshot endpoint in src/frontend/app/api/metrics/[appId]/route.ts
- [X] T023 [US1] Implement GET run metrics summary endpoint in src/frontend/app/api/pipeline/[runId]/metrics/route.ts

**Checkpoint**: User Story 1 is independently functional and testable.

---

## Phase 4: User Story 2 - Persist Auditable Historical Snapshots (Priority: P2)

**Goal**: Persist immutable historical snapshots with run lineage and rule-context traceability.

**Independent Test**: Execute two runs for one app and verify two immutable, traceable snapshots with correct ordering.

### Tests for User Story 2

- [X] T024 [P] [US2] Add contract test for historical snapshot payload shape in tests/contract/metrics/metrics-history.contract.test.ts
- [X] T025 [P] [US2] Add integration test for immutable append-only snapshot behavior in tests/integration/metrics/metric-snapshot-history.integration.test.ts
- [X] T026 [P] [US2] Add integration test for rule-context traceability across runs in tests/integration/metrics/metric-traceability.integration.test.ts

### Implementation for User Story 2

- [X] T027 [US2] Enforce per-run immutable insert semantics and lineage metadata in database/stored-procedures/usp_CalculateMetrics.sql
- [X] T028 [US2] Implement historical query methods with pagination and date filters in src/frontend/infrastructure/persistence/database/MetricsDbRepository.ts
- [X] T029 [US2] Implement in-memory historical query parity for tests in src/frontend/infrastructure/persistence/memory/MetricsMemoryRepository.ts
- [X] T030 [US2] Implement GET metrics history endpoint in src/frontend/app/api/metrics/history/[appId]/route.ts
- [X] T031 [US2] Add rule-context and metric-definition fields to metric snapshot domain model in src/frontend/core/domain/entities/MetricSnapshot.ts

**Checkpoint**: User Stories 1 and 2 are independently functional and auditable.

---

## Phase 5: User Story 3 - Provide Interim Investment Dummy Dataset (Priority: P3)

**Goal**: Provide deterministic, idempotent, non-authoritative synthetic investment data for non-production workflows.

**Independent Test**: Seed twice for the same scope/date and verify no duplicate synthetic business keys, with non-authoritative labeling retained.

### Tests for User Story 3

- [X] T032 [P] [US3] Add contract test for synthetic investment retrieval labeling in tests/contract/metrics/investment-dummy-labeling.contract.test.ts
- [X] T033 [P] [US3] Add integration test for idempotent synthetic seed behavior in tests/integration/metrics/investment-dummy-seed.integration.test.ts
- [X] T034 [P] [US3] Add integration test for non-production-only exposure guard in tests/integration/metrics/investment-dummy-scope.integration.test.ts

### Implementation for User Story 3

- [X] T035 [US3] Implement deterministic synthetic seed upsert logic with unique business key in database/seed/seed-investment-dummy-facts.sql
- [X] T036 [US3] Add synthetic dataset retrieval method with environment guard in src/frontend/infrastructure/persistence/database/MetricsDbRepository.ts
- [X] T037 [US3] Add synthetic dataset retrieval parity in src/frontend/infrastructure/persistence/memory/MetricsMemoryRepository.ts
- [X] T038 [US3] Extend metrics retrieval service to include non-authoritative synthetic context when allowed in src/frontend/core/application/services/metricsRetrievalService.ts

**Checkpoint**: All user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final consistency, documentation, and performance hardening across stories.

- [X] T039 [P] Add EPIC-007 operational runbook notes and query examples in specs/008-metrics-calculation-dashboard/quickstart.md
- [X] T040 [P] Add API usage examples and error matrix refinements in specs/008-metrics-calculation-dashboard/contracts/metrics-calculation-contract.md
- [X] T041 Execute full metrics validation suite and capture evidence in tests/integration/metrics/README.md
- [X] T042 Validate CI quality gates for lint, typecheck, and tests using scripts/ci/validate-ci-locally.ps1

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 (Setup): No dependencies.
- Phase 2 (Foundational): Depends on Phase 1 and blocks all user stories.
- Phase 3 (US1): Depends on Phase 2 only.
- Phase 4 (US2): Depends on Phase 2 and builds on US1 snapshot contracts.
- Phase 5 (US3): Depends on Phase 2 and can proceed in parallel with US2 once shared repository interfaces are stable.
- Phase 6 (Polish): Depends on all selected stories being complete.

### User Story Dependencies

- US1 (P1): First MVP increment; no dependency on other stories after Phase 2.
- US2 (P2): Requires foundational snapshot schema/procedure and reuses US1 retrieval patterns.
- US3 (P3): Requires foundational persistence adapters; independent from US2 functional behavior.

### Within Each User Story

- Tests first, then SQL/domain models, then services/adapters, then API routes, then integration hardening.
- Each story must pass its independent test criteria before moving to the next priority.

---

## Parallel Opportunities

- Setup parallel tasks: T003, T004, T005, T006.
- Foundational parallel tasks: T010, T011, T013, T014.
- US1 parallel tests: T015, T016, T017.
- US2 parallel tests: T024, T025, T026.
- US3 parallel tests: T032, T033, T034.
- Cross-story opportunity after Phase 2: US2 and US3 can be staffed concurrently.

---

## Parallel Example: User Story 1

```bash
Task T015: Contract test formulas in tests/contract/metrics/metrics-calculation.contract.test.ts
Task T016: Integration test lifecycle in tests/integration/metrics/pipeline-metrics-lifecycle.integration.test.ts
Task T017: Unit test service mapping in tests/unit/frontend/core/application/services/metricsRetrievalService.test.ts
```

---

## Parallel Example: User Story 2

```bash
Task T024: Contract test history payload in tests/contract/metrics/metrics-history.contract.test.ts
Task T025: Integration test append-only behavior in tests/integration/metrics/metric-snapshot-history.integration.test.ts
Task T026: Integration test traceability in tests/integration/metrics/metric-traceability.integration.test.ts
```

---

## Parallel Example: User Story 3

```bash
Task T032: Contract test synthetic labeling in tests/contract/metrics/investment-dummy-labeling.contract.test.ts
Task T033: Integration test idempotent seeding in tests/integration/metrics/investment-dummy-seed.integration.test.ts
Task T034: Integration test non-prod exposure guard in tests/integration/metrics/investment-dummy-scope.integration.test.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Deliver Phase 3 (US1) end-to-end.
3. Validate independent test criteria for US1.
4. Demo/deploy MVP metrics calculation capability.

### Incremental Delivery

1. Foundation complete (Phases 1-2).
2. Deliver US1 (core KPI calculation).
3. Deliver US2 (auditable history and traceability).
4. Deliver US3 (interim synthetic investment support).
5. Complete Polish phase and CI validation.

### Parallel Team Strategy

1. Team completes Phases 1-2 together.
2. Engineer A: US1 SQL + run lifecycle tasks.
3. Engineer B: US2 history/retrieval tasks.
4. Engineer C: US3 synthetic dataset tasks.
5. Converge for Phase 6 validation and documentation hardening.

---

## Notes

- All tasks follow strict checklist format: checkbox, Task ID, optional [P], optional [US#], action with file path.
- [P] marks tasks that can execute concurrently without file conflicts.
- Keep SQL calculation logic in database/stored-procedures and keep API routes thin per clean architecture principles.
- Preserve role-scoped access and non-production-only guardrails for synthetic investment data.
