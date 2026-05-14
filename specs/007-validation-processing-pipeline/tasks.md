# Tasks: Validation Processing Pipeline (EPIC-BQM-006)

**Input**: Design documents from /specs/007-validation-processing-pipeline/
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/processing-workflow-contract.md, quickstart.md

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish migration, pipeline, and test scaffolding for the feature.

- [X] T001 Create migration scripts 015-025 in database/migrations/ (015_create_pipeline_runs.sql through 025_align_stageid_types.sql), with 021_create_metric_snapshots.sql scoped to table creation only (no metric calculation flow implementation in this epic)
- [X] T002 Create rollback scripts for new objects in database/rollback/rollback_015_025_validation_processing.sql
- [X] T003 [P] Create ADF processing pipeline definition skeleton in pipelines/numerator-processing/pipeline.json
- [X] T004 [P] Add validation-pipeline test folders and README placeholders in tests/contract/validation-pipeline/README.md and tests/integration/validation-pipeline/README.md
- [X] T005 [P] Add local runbook migration references for new scripts in specs/007-validation-processing-pipeline/quickstart.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the cross-story foundation required by all user stories.

**CRITICAL**: Complete this phase before starting user story phases.

- [X] T006 Create domain entities for pipeline state in src/frontend/core/domain/entities/PipelineRun.ts, src/frontend/core/domain/entities/ValidationResult.ts, and src/frontend/core/domain/entities/MatchedRecord.ts
- [X] T007 Create pipeline contracts in src/frontend/core/domain/repositories/IValidationPipelineRepository.ts and src/frontend/core/application/clients/IADFPipelineClient.ts
- [X] T008 [P] Create SQL query primitives for pipeline persistence in src/frontend/infrastructure/persistence/database/queries/validation-pipeline-queries.ts
- [X] T009 [P] Create SQL repository implementation in src/frontend/infrastructure/persistence/database/ValidationPipelineDbRepository.ts
- [X] T010 [P] Create deterministic in-memory repository in src/frontend/infrastructure/persistence/memory/ValidationPipelineMemoryRepository.ts
- [X] T011 Wire repository resolution in src/frontend/infrastructure/persistence/runtime/repositories.ts
- [X] T012 Create application orchestration services in src/frontend/core/application/services/validationPipelineService.ts and src/frontend/core/application/services/pipelineOrchestrationService.ts
- [X] T013 [P] Add request/response validation schemas in src/frontend/infrastructure/validation/pipelineSchemas.ts
- [X] T014 [P] Add ADF trigger client and local fallback adapter in src/frontend/infrastructure/clients/ADFPipelineClient.ts implementing IADFPipelineClient
- [X] T015 Add shared authorization guard helpers for app-scoped pipeline actions in src/frontend/lib/auth/pipelineAuthorization.ts

**Checkpoint**: Foundation complete. User stories can now be implemented independently.

---

## Phase 3: User Story 1 - Validate Numerator Records Against Filtered Denominator (Priority: P1)

**Goal**: Validate staged numerator records against filtered denominator and persist Valid/Invalid/Duplicate statuses.

**Independent Test**: Run pipeline for one application with mixed valid, invalid, duplicate, and missing-key records; verify status and error context persisted per record.

### Tests for User Story 1

- [X] T016 [P] [US1] Add contract tests for run trigger and status endpoints in tests/contract/validation-pipeline/pipeline-run.contract.test.ts
- [X] T017 [P] [US1] Add integration test for ID validation outcomes in tests/integration/validation-pipeline/id-validation.integration.test.ts
- [X] T067 [P] [US1] Add integration test for staging immutability (no update/delete on stage.EngagementUsageRaw) in tests/integration/validation-pipeline/staging-immutability.integration.test.ts

### Implementation for User Story 1

- [X] T018 [US1] Implement app.PipelineRuns table migration in database/migrations/015_create_pipeline_runs.sql
- [X] T019 [US1] Implement app.ValidationResults table migration in database/migrations/016_create_validation_results.sql
- [X] T020 [US1] Implement denominator local view migration in database/migrations/020_create_vw_denominator_local.sql
- [X] T021 [US1] Implement SP app.usp_BuildFilteredDenominator in database/migrations/022_create_usp_build_filtered_denominator.sql
- [X] T022 [US1] Implement validation stage logic in SP app.usp_ExecutePipelineRun within database/migrations/024_create_usp_execute_pipeline_run.sql
- [X] T023 [US1] Implement pipeline run creation and retrieval methods in src/frontend/infrastructure/persistence/database/ValidationPipelineDbRepository.ts
- [X] T024 [US1] Implement POST trigger route in src/frontend/app/api/pipeline/run/route.ts
- [X] T025 [US1] Implement GET run status route in src/frontend/app/api/pipeline/[runId]/route.ts
- [X] T068 [US1] Enforce read-only staging behavior in database/migrations/024_create_usp_execute_pipeline_run.sql and verify no stage mutation statements are introduced

**Checkpoint**: US1 works independently and is testable end-to-end.

---

## Phase 4: User Story 2 - Apply Denominator Filter Rules Per Application (Priority: P1)

**Goal**: Build filtered denominator population per app using active denominator rules and canonical operators.

**Independent Test**: Configure denominator rules for one app, execute run, and verify filtered denominator count and empty-denominator handling.

### Tests for User Story 2

- [X] T026 [P] [US2] Add integration test for denominator rule application and empty result handling in tests/integration/validation-pipeline/denominator-filtering.integration.test.ts
- [X] T027 [P] [US2] Add contract test for denominator-related pipeline error/status propagation in tests/contract/validation-pipeline/denominator-pipeline.contract.test.ts

### Implementation for User Story 2

- [X] T028 [US2] Implement stage.DenominatorSnapshot migration in database/migrations/019_create_denominator_snapshot.sql
- [X] T029 [US2] Implement denominator dynamic SQL operator dispatch in database/migrations/022_create_usp_build_filtered_denominator.sql
- [X] T030 [US2] Enforce canonical operator mapping and guardrails in src/frontend/infrastructure/persistence/database/queries/validation-pipeline-queries.ts
- [X] T031 [US2] Persist denominator snapshot date on runs in src/frontend/infrastructure/persistence/database/ValidationPipelineDbRepository.ts

**Checkpoint**: US2 works independently and is testable end-to-end.

---

## Phase 5: User Story 4 - Match Numerator to Filtered Denominator (Priority: P1)

**Goal**: Persist matched numerator-denominator intersection by engagement/client adoption level.

**Independent Test**: Provide known numerator and denominator sets for engagement-level and client-level apps; verify MatchedRecords intersection is exact.

### Tests for User Story 4

- [X] T032 [P] [US4] Add integration test for engagement vs client matching behavior in tests/integration/validation-pipeline/matching.integration.test.ts
- [X] T033 [P] [US4] Add integration test for matched record persistence traceability in tests/integration/validation-pipeline/matched-records.integration.test.ts

### Implementation for User Story 4

- [X] T034 [US4] Implement app.MatchedRecords table migration in database/migrations/017_create_matched_records.sql
- [X] T035 [US4] Implement matching logic in orchestrator SP in database/migrations/024_create_usp_execute_pipeline_run.sql
- [X] T036 [US4] Implement matched-record persistence methods in src/frontend/infrastructure/persistence/database/ValidationPipelineDbRepository.ts
- [X] T037 [US4] Implement in-memory matching persistence parity in src/frontend/infrastructure/persistence/memory/ValidationPipelineMemoryRepository.ts

**Checkpoint**: US4 works independently and is testable end-to-end.

---

## Phase 6: User Story 7 - Asynchronous Pipeline Execution With Run Tracking (Priority: P1)

**Goal**: Trigger one-app run asynchronously with ADF in production and local fallback in development, while exposing run lifecycle metadata.

**Independent Test**: Trigger run and confirm immediate API response plus subsequent state transitions Queued -> Processing -> Completed/Failed.

### Tests for User Story 7

- [X] T038 [P] [US7] Add contract tests for async trigger responses and conflict handling in tests/contract/validation-pipeline/async-trigger.contract.test.ts
- [X] T039 [P] [US7] Add integration test for lifecycle transitions and metadata counts in tests/integration/validation-pipeline/run-lifecycle.integration.test.ts

### Implementation for User Story 7

- [X] T040 [US7] Implement app.FilterRuleSnapshots table migration in database/migrations/018_create_filter_rule_snapshots.sql
- [X] T041 [US7] Implement app.usp_ExecutePipelineRun orchestrator migration in database/migrations/024_create_usp_execute_pipeline_run.sql
- [X] T042 [US7] Implement ADF trigger and local fallback execution in src/frontend/infrastructure/clients/ADFPipelineClient.ts
- [X] T043 [US7] Implement orchestration service for one-application execution in src/frontend/core/application/services/pipelineOrchestrationService.ts using IADFPipelineClient from core/application/clients
- [X] T044 [US7] Implement run metadata projection in src/frontend/core/application/services/validationPipelineService.ts
- [X] T045 [US7] Implement ADF pipeline JSON invocation contract in pipelines/numerator-processing/pipeline.json

**Checkpoint**: US7 works independently and is testable end-to-end.

---

## Phase 7: User Story 3 - Apply Numerator Filter Rules Per Application (Priority: P2)

**Goal**: Apply app-configured numerator filter rules (AND-combined) to validated records and mark filtered-out reasons.

**Independent Test**: Configure numerator rules, run pipeline, and verify filtered-out statuses and reason messages for non-matching records.

### Tests for User Story 3

- [X] T046 [P] [US3] Add integration test for numerator filter application and filtered-out reasons in tests/integration/validation-pipeline/numerator-filtering.integration.test.ts
- [X] T047 [P] [US3] Add contract tests for validation result filtering query parameters in tests/contract/validation-pipeline/validation-results-filter.contract.test.ts

### Implementation for User Story 3

- [X] T048 [US3] Implement SP app.usp_ApplyNumeratorFilters migration in database/migrations/023_create_usp_apply_numerator_filters.sql
- [X] T049 [US3] Implement numerator filter invocation from orchestrator SP in database/migrations/024_create_usp_execute_pipeline_run.sql
- [X] T050 [US3] Add filtered-out error context persistence in src/frontend/infrastructure/persistence/database/queries/validation-pipeline-queries.ts
- [X] T051 [US3] Add in-memory parity for filtered-out behavior in src/frontend/infrastructure/persistence/memory/ValidationPipelineMemoryRepository.ts

**Checkpoint**: US3 works independently and is testable end-to-end.

---

## Phase 8: User Story 5 - Persist Validation Results With Error Context (Priority: P2)

**Goal**: Persist one result per processed record with explicit reason context and run linkage.

**Independent Test**: Execute run with diverse failures and verify each processed record has persisted status and reason message linked to PipelineRunId.

### Tests for User Story 5

- [X] T052 [P] [US5] Add integration test for full result persistence coverage in tests/integration/validation-pipeline/validation-results-persistence.integration.test.ts
- [X] T053 [P] [US5] Add contract tests for result payload shape and paging in tests/contract/validation-pipeline/validation-results-pagination.contract.test.ts

### Implementation for User Story 5

- [X] T054 [US5] Implement StageId alignment migration in database/migrations/025_align_stageid_types.sql
- [X] T055 [US5] Implement detailed error reason persistence in database/migrations/024_create_usp_execute_pipeline_run.sql
- [X] T056 [US5] Implement validation results query API routes in src/frontend/app/api/pipeline/validation-results/[appId]/route.ts and src/frontend/app/api/pipeline/validation-results/[appId]/summary/route.ts
- [X] T057 [US5] Implement role-scoped result retrieval in src/frontend/core/application/services/validationPipelineService.ts

**Checkpoint**: US5 works independently and is testable end-to-end.

---

## Phase 9: User Story 6 - Surface Validation Errors to Users (Priority: P3)

**Goal**: Expose role-scoped summary and detail views of validation outcomes for application owners and admins.

**Independent Test**: Trigger run with known errors and verify authorized users see summary/error breakdown for assigned applications only.

### Tests for User Story 6

- [X] T058 [P] [US6] Add contract tests for app-scoped authorization behavior in tests/contract/validation-pipeline/validation-visibility.contract.test.ts
- [X] T059 [P] [US6] Add integration test for summary/error breakdown rendering data in tests/integration/validation-pipeline/validation-summary.integration.test.ts

### Implementation for User Story 6

- [X] T060 [US6] Implement summary DTO mapping for grouped error breakdown in src/frontend/core/application/services/validationPipelineService.ts
- [X] T061 [US6] Implement validation summary UI binding in src/frontend/app/components/ValidationSummary.tsx
- [X] T062 [US6] Implement run-status to summary navigation flow in src/frontend/app/page.tsx

**Checkpoint**: US6 works independently and is testable end-to-end.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Final hardening, consistency updates, and documentation closure.

- [X] T063 [P] Align contract and quickstart endpoint shapes in specs/007-validation-processing-pipeline/contracts/processing-workflow-contract.md and specs/007-validation-processing-pipeline/quickstart.md
- [X] T064 [P] Add operational troubleshooting notes for ADF and local fallback in specs/007-validation-processing-pipeline/quickstart.md
- [X] T065 Run full validation command set and capture outcomes in specs/007-validation-processing-pipeline/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 Setup has no dependencies and starts immediately.
- Phase 2 Foundational depends on Phase 1 and blocks all user stories.
- Phases 3-9 (user stories) depend on Phase 2.
- Phase 10 Polish depends on completion of desired user stories.

### User Story Dependencies

- US1 depends on foundational phase only.
- US2 depends on foundational phase only.
- US4 depends on US1 and US2 completion.
- US7 depends on US1 completion.
- US3 depends on US1 completion.
- US5 depends on US1 and US3 completion.
- US6 depends on US5 completion.

### Within Each User Story

- Tests are written first and should fail before implementation.
- Database artifacts precede service and API integration.
- Service logic precedes route and UI wiring.
- Story-specific checkpoint must pass before proceeding.

## Parallel Opportunities

- Setup tasks marked [P] can run together (T003, T004, T005).
- Foundational tasks marked [P] can run together (T008, T009, T010, T013, T014).
- US1 tests T016/T017 can run in parallel.
- US1 staging immutability test T067 can run in parallel with T016/T017.
- US2 tests T026/T027 can run in parallel.
- US4 tests T032/T033 can run in parallel.
- US7 tests T038/T039 can run in parallel.
- US3 tests T046/T047 can run in parallel.
- US5 tests T052/T053 can run in parallel.
- US6 tests T058/T059 can run in parallel.
- Polish tasks T063/T064 can run in parallel.

---

## Parallel Example: User Story 1

- Contract test task: T016 tests/contract/validation-pipeline/pipeline-run.contract.test.ts
- Integration test task: T017 tests/integration/validation-pipeline/id-validation.integration.test.ts
- In parallel model/repository setup: T018, T019, T023

## Parallel Example: User Story 7

- Async trigger contract test: T038 tests/contract/validation-pipeline/async-trigger.contract.test.ts
- Lifecycle integration test: T039 tests/integration/validation-pipeline/run-lifecycle.integration.test.ts
- In parallel infrastructure work: T042 and T045

---

## Implementation Strategy

### MVP First (P1 Stories)

1. Complete Phase 1 and Phase 2.
2. Deliver US1 (validation baseline).
3. Deliver US2 (denominator filtering).
4. Deliver US4 (matching).
5. Deliver US7 (async execution and run tracking).
6. Validate MVP end-to-end before P2/P3.

### Incremental Delivery

1. MVP release with P1 stories (US1, US2, US4, US7).
2. Add P2 quality depth (US3, US5).
3. Add P3 user-facing error surfacing (US6).
4. Finish cross-cutting polish and documentation.

### Team Parallelization Strategy

1. Team completes Setup and Foundational together.
2. After foundational checkpoint:
   - Developer A: US1 and US5 track
   - Developer B: US2 and US4 track
   - Developer C: US7 and US6 track
3. Merge by story checkpoints and run contract/integration suites after each merge.
