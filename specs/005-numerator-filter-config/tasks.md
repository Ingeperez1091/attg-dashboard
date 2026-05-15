# Tasks: Epic 004 - Numerator Filter Configuration

**Input**: Design documents from `specs/005-numerator-filter-config/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize scaffolding and shared folders for implementation and testing.

- [X] T001 Create feature test directories in `tests/contract/filters/numerator-filter-config/` and `tests/integration/filters/numerator-filter-config/`
- [X] T002 Create feature API route folders in `src/frontend/app/api/filters/numerator/[appId]/` and `src/frontend/app/api/applications/[appId]/numeratormodel/`
- [X] T003 [P] Create feature domain/use case folders in `src/frontend/core/application/usecases/`, `src/frontend/core/application/dto/`, and `src/frontend/core/domain/valueobjects/`
- [X] T004 [P] Create feature persistence folders in `src/frontend/core/domain/repositories/`, `src/frontend/infrastructure/persistence/repositories/`, and `src/frontend/infrastructure/persistence/mssql/queries/`
- [X] T005 [P] Create feature validation/middleware folders in `src/frontend/infrastructure/validation/` and `src/frontend/infrastructure/middleware/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build database and platform foundations required by all user stories.

- [X] T006 Add `IsActive` soft-delete support and active-only indexes/constraints in `database/migrations/007_create_numerator_filter_rules.sql`
- [X] T007 [P] Add/align schema definitions for `app.ApplicationModelFields` and `app.NumeratorFilterRules` in `database/schema/app/ApplicationModelFields.sql` and `database/schema/app/NumeratorFilterRules.sql`
- [X] T008 [P] Add rollback behavior for soft-delete compatible migrations in `database/rollback/rollback_007_create_numerator_filter_rules.sql`
- [X] T009 Implement migration execution and rollback ordering checks in `scripts/database/run-migrations.ps1` and `scripts/database/run-rollback.ps1`
- [X] T010 Create shared Zod schemas for numerator rule/model payloads and error envelope in `src/frontend/infrastructure/validation/filterRuleSchemas.ts`
- [X] T011 Create `INumeratorFilterRepository` contract with active-only retrieval and soft-replace semantics in `src/frontend/core/domain/repositories/INumeratorFilterRepository.ts`
- [X] T012 [P] Wire repository runtime selection for new numerator repositories in `src/frontend/infrastructure/persistence/runtime/index.ts`
- [X] T013 Implement shared authorization guard for role + app assignment checks in `src/frontend/infrastructure/middleware/filterAuthorizationMiddleware.ts`
- [X] T049 Add schema/DDL for `RuleChangeAudit` persistence and constraints in `database/schema/app/RuleChangeAudit.sql` and migration scripts

**Checkpoint**: Core database, validation, repository, and authorization building blocks are ready.

---

## Phase 3: User Story 4 - Seed Application Model Definitions (Priority: P0)

**Goal**: Seed complete model field metadata for all five applications with idempotent behavior.

**Independent Test**: Run seed twice and verify exact field counts/filterable counts per app with no duplicates.

### Tests for User Story 4

- [X] T014 [P] [US4] Add contract SQL test for seeded model counts, filterability, and idempotency in `tests/contract/filters/numerator-filter-config/db-schema.contract.sql`
- [X] T015 [P] [US4] Add integration SQL test for seed re-run idempotency in `tests/integration/filters/numerator-filter-config/application-model.integration.ts`

### Implementation for User Story 4

- [X] T016 [US4] Implement seed data for all 32 model fields across 5 apps in `database/migrations/009_seed_application_model_fields.sql`
- [X] T017 [US4] Add rollback script for seeded application model fields in `database/rollback/rollback_009_seed_application_model_fields.sql`
- [X] T018 [US4] Document seed verification query and expected output in `specs/005-numerator-filter-config/quickstart.md`

**Checkpoint**: Application model metadata exists and is reproducible.

---

## Phase 4: User Story 1 - View Numerator Filter Rules by Application Scope (Priority: P1)

**Goal**: Allow authorized users to retrieve scoped numerator rule sets and model metadata.

**Independent Test**: Verify GET endpoints return only allowed app data and active rules with resolved field metadata.

### Tests for User Story 1

- [X] T019 [P] [US1] Add contract tests for `GET /api/filters/numerator/:appId` (200/401/403/404) in `tests/contract/filters/numerator-filter-config/api-filter-rules-get.contract.ts`
- [X] T020 [P] [US1] Add contract tests for `GET /api/applications/:appId/numeratormodel` (200/401/403/404), including non-filterable fields returned with `isFilterable=false`, in `tests/contract/filters/numerator-filter-config/api-application-model.contract.ts`
- [X] T021 [P] [US1] Add integration tests for scoped retrieval and active-only rules in `tests/integration/filters/numerator-filter-config/filter-crud.integration.ts`

### Implementation for User Story 1

- [X] T022 [US1] Implement `GetNumeratorFiltersUseCase` with app-scope enforcement in `src/frontend/core/application/usecases/GetNumeratorFiltersUseCase.ts`
- [X] T023 [US1] Implement `GetApplicationNumeratorModelUseCase` returning all active per-app fields with `isFilterable` flags in `src/frontend/core/application/usecases/GetApplicationNumeratorModelUseCase.ts`
- [X] T024 [US1] Implement SQL query module for active rule retrieval (`IsActive = 1`) and model field lookup in `src/frontend/infrastructure/persistence/mssql/queries/NumeratorFilters.ts`
- [X] T025 [US1] Implement repository read methods in `src/frontend/infrastructure/persistence/repositories/NumeratorFilterSqlRepository.ts`
- [X] T026 [US1] Implement GET route handler for filters in `src/frontend/app/api/filters/numerator/[appId]/route.ts`
- [X] T027 [US1] Implement GET route handler for model metadata in `src/frontend/app/api/applications/[appId]/numeratormodel/route.ts`
- [ ] T055 [US1] Include rule-level `CreatedBy` and `UpdatedBy` in GET filters response DTO for UI audit display in `src/frontend/core/application/dto/NumeratorFilterDTO.ts` and `src/frontend/app/api/filters/numerator/[appId]/route.ts`

**Checkpoint**: Read-only scoped retrieval works end-to-end.

---

## Phase 5: User Story 2 - Create and Edit Numerator Filter Expressions (Priority: P2)

**Goal**: Enable authorized create/update of validated rules with soft-replace (`IsActive` based lifecycle).

**Independent Test**: Submit valid and invalid PUT payloads and verify atomic soft-replace, validation errors, and unchanged prior active rules on failure.

### Tests for User Story 2

- [X] T028 [P] [US2] Add contract tests for `PUT /api/filters/numerator/:appId` (200/400/401/403/404/409) in `tests/contract/filters/numerator-filter-config/api-filter-rules-put.contract.ts`
- [X] T029 [P] [US2] Add contract test coverage for `FIELD_NOT_FILTERABLE` validation response in `tests/contract/filters/numerator-filter-config/api-filter-rules-put.contract.ts`
- [X] T030 [P] [US2] Add integration tests for soft-replace update (`IsActive = 0` old rules, `IsActive = 1` new rules) in `tests/integration/filters/numerator-filter-config/filter-crud.integration.ts`
- [X] T031 [P] [US2] Add integration tests for invalid submissions preserving prior active rule set in `tests/integration/filters/numerator-filter-config/filter-crud.integration.ts`
- [X] T052 [P] [US2] Add integration tests asserting `RuleChangeAudit` previous/new snapshot persistence on accepted updates in `tests/integration/filters/numerator-filter-config/filter-audit.integration.ts`

### Implementation for User Story 2

- [X] T032 [US2] Implement `FieldOperator` operator-type validation logic in `src/frontend/core/domain/valueobjects/FieldOperator.ts`
- [X] T033 [US2] Implement `FilterRule` value object and validation hooks in `src/frontend/core/domain/valueobjects/FilterRule.ts`
- [X] T034 [US2] Implement `UpdateNumeratorFiltersUseCase` with filterable-field validation and atomic soft-replace in `src/frontend/core/application/usecases/UpdateNumeratorFiltersUseCase.ts`
- [X] T035 [US2] Implement repository update method using transaction + soft-delete update + active insert in `src/frontend/infrastructure/persistence/repositories/NumeratorFilterSqlRepository.ts`
- [X] T036 [US2] Implement in-memory repository parity for update semantics in `src/frontend/infrastructure/persistence/repositories/NumeratorFilterInMemoryRepository.ts`
- [X] T037 [US2] Implement PUT route handler with Zod validation and structured error responses in `src/frontend/app/api/filters/numerator/[appId]/route.ts`
- [X] T054 [US2] Persist `RuleChangeAudit` entries (actor, previous rules, new rules, timestamp) in update flow in `src/frontend/infrastructure/persistence/repositories/NumeratorFilterSqlRepository.ts`
- [X] T056 [US2] Return explicit HTTP 400 (`FIELD_NOT_FILTERABLE`) when non-filterable fields are submitted in `src/frontend/core/application/usecases/UpdateNumeratorFiltersUseCase.ts` and `src/frontend/app/api/filters/numerator/[appId]/route.ts`

**Checkpoint**: Rule update flow supports validated edits with deterministic soft-delete behavior.

---

## Phase 6: Front-End Editor Behavior Coverage (G3)

**Purpose**: Ensure UI behavior is explicitly implemented and tested for field enablement, operator adaptation, and audit display.

### Tests for UI Behavior Coverage

- [ ] T057 [P] Add component/integration tests for field selector behavior (show all active fields, disable `isFilterable=false`) in `tests/integration/filters/numerator-filter-config/filter-ui.integration.ts`
- [ ] T058 [P] Add component/integration tests for type-aware operator options by field type in `tests/integration/filters/numerator-filter-config/filter-ui.integration.ts`
- [ ] T059 [P] Add component/integration tests for rendering `CreatedBy` / `UpdatedBy` audit metadata in rule list UI in `tests/integration/filters/numerator-filter-config/filter-ui.integration.ts`

### Implementation for UI Behavior Coverage

- [X] T060 Implement `NumeratorRuleEditor` field selector behavior to disable non-filterable options while showing all active fields in `src/frontend/app/components/filters/NumeratorRuleEditor.tsx`
- [X] T061 Implement UI rendering for rule-level `CreatedBy` and `UpdatedBy` metadata in `src/frontend/app/components/filters/NumeratorRuleList.tsx`
- [X] T064 Implement Numerator Filter Configuration page and route it from the `Filter Rules` navigation menu in `src/frontend/app/filters/numerator/page.tsx` and `src/frontend/app/components/NavBar.tsx`

**Checkpoint**: UI behavior coverage for FR-006/FR-016 and audit-display requirement is explicit and testable.

---

## Phase 7: User Story 3 - Enforce Role and Assignment Boundaries (Priority: P3)

**Goal**: Guarantee role/assignment authorization boundaries for view/edit actions.

**Independent Test**: Verify viewer/unassigned owner denied edits, assigned owner and admin accepted, with proper 401/403 behavior.

### Tests for User Story 3

- [ ] T038 [P] [US3] Add contract authorization tests for all numerator endpoints in `tests/contract/filters/numerator-filter-config/api-filter-rules-authz.contract.ts`
- [ ] T039 [P] [US3] Add integration authorization matrix tests in `tests/integration/filters/numerator-filter-config/filter-authz.integration.ts`

### Implementation for User Story 3

- [ ] T040 [US3] Enforce authorization middleware in GET/PUT routes for numerator filters in `src/frontend/app/api/filters/numerator/[appId]/route.ts`
- [ ] T041 [US3] Enforce authorization middleware in application model route in `src/frontend/app/api/applications/[appId]/numeratormodel/route.ts`
- [ ] T042 [US3] Add domain-specific authorization error mapping for 401/403 responses in `src/frontend/core/domain/errors/FilterValidationError.ts`

**Checkpoint**: Access control and error semantics are consistent across endpoints.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final consistency, documentation, and quality hardening across all stories.

- [ ] T043 [P] Update OpenAPI contract for soft-replace and active-only retrieval semantics in `specs/005-numerator-filter-config/contracts/numerator-filter-config.openapi.yaml`
- [ ] T044 [P] Align markdown API contracts with OpenAPI error envelope and soft-delete behavior in `specs/005-numerator-filter-config/contracts/GET-numerator-filters.contract.md` and `specs/005-numerator-filter-config/contracts/PUT-numerator-filters.contract.md`
- [ ] T045 [P] Align design docs with finalized behavior (`IsActive`, `FIELD_NOT_FILTERABLE`, active-only retrieval) in `specs/005-numerator-filter-config/plan.md`, `specs/005-numerator-filter-config/research.md`, and `specs/005-numerator-filter-config/data-model.md`
- [X] T046 Run quickstart validation steps and record any doc corrections in `specs/005-numerator-filter-config/quickstart.md`
- [X] T047 Execute full feature test run and capture results in `tests/integration/filters/numerator-filter-config/README.md`
- [ ] T048 [P] Update root implementation references for Epic 004 in `README.md`
- [X] T062 Add performance validation suite and threshold assertions (p95 <= 3s for GET/PUT) in `tests/integration/filters/numerator-filter-config/filter-performance.integration.ts`
- [X] T063 Document performance validation execution and evidence format in `specs/005-numerator-filter-config/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 (Setup): no dependencies.
- Phase 2 (Foundational): depends on Phase 1 and blocks all user stories.
- Phase 3 (US4, P0): depends on Phase 2; should complete before heavy endpoint/UI work.
- Phase 4 (US1, P1): depends on Phase 2; can proceed in parallel with US4 test work after schema readiness.
- Phase 5 (US2, P2): depends on US1 read-path scaffolding and US4 model data.
- Phase 6 (UI Behavior Coverage): depends on US1/US2 API payload availability.
- Phase 7 (US3, P3): depends on US1/US2 endpoints.
- Phase 8 (Polish): depends on all targeted stories.

### User Story Dependencies

- US4 (P0): independent after foundational setup; enables realistic downstream behavior.
- US1 (P1): independent after foundational setup.
- US2 (P2): depends on US1 endpoint/repository baseline and US4 seeded model fields.
- US3 (P3): depends on endpoint availability from US1/US2.

### Within Each User Story

- Write contract/integration tests first and ensure they fail before implementation.
- Implement domain/value objects before use case orchestration.
- Implement repository behavior before route handlers.
- Validate story independently at checkpoint before advancing.

---

## Parallel Execution Examples

### US4 Parallel Example

- [P] T014 in `tests/contract/filters/numerator-filter-config/db-schema.contract.sql`
- [P] T015 in `tests/integration/filters/numerator-filter-config/application-model.integration.ts`

### US1 Parallel Example

- [P] T019 in `tests/contract/filters/numerator-filter-config/api-filter-rules-get.contract.ts`
- [P] T020 in `tests/contract/filters/numerator-filter-config/api-application-model.contract.ts`
- [P] T021 in `tests/integration/filters/numerator-filter-config/filter-crud.integration.ts`

### US2 Parallel Example

- [P] T028 and T029 in `tests/contract/filters/numerator-filter-config/api-filter-rules-put.contract.ts`
- [P] T030 and T031 in `tests/integration/filters/numerator-filter-config/filter-crud.integration.ts`

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete US4 (Phase 3) and US1 (Phase 4).
3. Validate read-only governance flow and seeded metadata.
4. Deliver MVP slice for visibility and data correctness.

### Incremental Delivery

1. Add US2 update/edit flow with strict validation and soft-delete lifecycle.
2. Add US3 authorization hardening and matrix validation.
3. Execute polish and cross-artifact consistency pass.

### Team Parallelization

1. Developer A: DB + repository foundations (T006-T013).
2. Developer B: Contracts/tests (T014-T021, T028-T031, T038-T039).
3. Developer C: API/use cases (T022-T027, T032-T037, T040-T042).
4. Joint finalization: polish tasks T043-T048.

---

## Format Validation

- All tasks follow required checklist format: `- [ ] T### [P?] [US?] Description with file path`.
- User story tasks include `[US#]` labels.
- Setup/foundational/polish tasks intentionally omit story labels.
- Task ordering is execution-oriented with explicit dependencies and checkpoints.
