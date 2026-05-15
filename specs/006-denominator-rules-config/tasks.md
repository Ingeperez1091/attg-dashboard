# Tasks: EPIC-008 Denominator Rules Configuration

**Input**: Design documents from `specs/006-denominator-rules-config/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `quickstart.md`, `contracts/denominator-rules-config.openapi.yaml`

**Tests**: Include contract and integration tests because testing expectations are explicitly defined in `spec.md` and `quickstart.md`.

**Organization**: Tasks are grouped by user story so each story remains independently implementable and testable.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish denominator feature scaffolding and migration ordering.

- [X] T001 Update denominator feature README notes and migration references in `database/migrations/README.md`
- [X] T002 Add denominator migration sequence entries (010-014) in `database/migrations/deployment-order.md`
- [X] T003 [P] Create denominator contract test folder scaffold in `tests/contract/filters/denominator-filter-config/.gitkeep`
- [X] T004 [P] Create denominator integration test folder scaffold in `tests/integration/filters/denominator-filter-config/.gitkeep`
- [X] T005 [P] Add denominator quickstart execution note for test commands in `specs/006-denominator-rules-config/quickstart.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core database/domain/repository infrastructure required before user stories.

**Critical**: User story implementation starts only after this phase is complete.

- [X] T006 Create `app.DenominatorModels` schema DDL in `database/schema/app/DenominatorModels.sql`
- [X] T007 Create `app.DenominatorFilterRules` schema DDL in `database/schema/app/DenominatorFilterRules.sql`
- [X] T008 Create `app.AdoptionSettings` schema DDL in `database/schema/app/AdoptionSettings.sql`
- [X] T009 Create migration 010 for denominator models in `database/migrations/010_create_denominator_models.sql`
- [X] T010 Create migration 011 for denominator filter rules in `database/migrations/011_create_denominator_filter_rules.sql`
- [X] T011 Create migration 012 for adoption settings in `database/migrations/012_create_adoption_settings.sql`
- [X] T012 Create migration 013 to add `ChangeScope` in `database/migrations/013_alter_rule_change_audit_add_scope.sql`
- [X] T013 Create migration 014 seed migration in `database/migrations/014_seed_denominator_models_and_adoption_settings.sql`
- [X] T014 Create denominator seed script in `database/seed/seed-denominator-models-and-adoption-settings.sql`
- [X] T015 [P] Add `IDenominatorModelRepository` in `src/frontend/core/domain/repositories/IDenominatorModelRepository.ts`
- [X] T016 [P] Add `IDenominatorFilterRepository` in `src/frontend/core/domain/repositories/IDenominatorFilterRepository.ts`
- [X] T017 [P] Add `IAdoptionSettingsRepository` in `src/frontend/core/domain/repositories/IAdoptionSettingsRepository.ts`
- [X] T018 Register new repository interfaces in `src/frontend/core/domain/repositories/RepositoryBundle.ts`
- [X] T019 Wire denominator repositories in `src/frontend/infrastructure/factories/RepositoryFactory.ts`
- [X] T020 Wire runtime repository access for denominator stack in `src/frontend/infrastructure/persistence/runtime/repositories.ts`

**Checkpoint**: Foundation complete, user stories can proceed.

---

## Phase 3: User Story 1 - View Denominator Rules for an Application (Priority: P1) 🎯 MVP

**Goal**: Authorized users can retrieve denominator model fields and current denominator rules per application.

**Independent Test**: `GET /api/denomindator-model` and `GET /api/filters/denominator/{appId}` return scoped data with correct role behavior.

### Tests (write first)

- [X] T021 [P] [US1] Add contract test for model retrieval endpoint in `tests/contract/filters/denominator-filter-config/get-denominator-model.contract.test.ts`
- [X] T022 [P] [US1] Add contract test for rules retrieval endpoint in `tests/contract/filters/denominator-filter-config/get-denominator-rules.contract.test.ts`
- [X] T023 [P] [US1] Add integration test for role-based view access in `tests/integration/filters/denominator-filter-config/view-rules-rbac.integration.test.ts`

### Implementation

- [X] T024 [P] [US1] Implement DB queries for denominator model reads in `src/frontend/infrastructure/persistence/database/queries/denominator-model-queries.ts`
- [X] T025 [P] [US1] Implement DB queries for denominator rule reads in `src/frontend/infrastructure/persistence/database/queries/denominator-filter-queries.ts`
- [X] T026 [P] [US1] Implement memory denominator model repository in `src/frontend/infrastructure/persistence/memory/DenominatorModelMemoryRepository.ts`
- [X] T027 [P] [US1] Implement memory denominator filter repository read path in `src/frontend/infrastructure/persistence/memory/DenominatorFilterMemoryRepository.ts`
- [X] T028 [US1] Implement SQL denominator model repository in `src/frontend/infrastructure/persistence/database/DenominatorModelDbRepository.ts`
- [X] T029 [US1] Implement SQL denominator filter repository read path in `src/frontend/infrastructure/persistence/database/DenominatorFilterDbRepository.ts`
- [X] T030 [US1] Implement view/read service methods in `src/frontend/core/application/services/DenominatorFilterService.ts`
- [X] T031 [US1] Implement model GET route in `src/frontend/app/api/denomindator-model/route.ts`
- [X] T032 [US1] Implement rules GET route in `src/frontend/app/api/filters/denominator/[appId]/route.ts`
- [X] T033 [US1] Implement read-only rules list UI in `src/frontend/app/components/filters/DenominatorRuleList.tsx`
- [X] T034 [US1] Implement denominator config page load flow in `src/frontend/app/filters/denominator/page.tsx`

**Checkpoint**: US1 independently functional and testable.

---

## Phase 4: User Story 2 - Edit Denominator Rules (Priority: P1)

**Goal**: Authorized users can create/replace denominator rules using valid field/operator/value combinations.

**Independent Test**: `PUT /api/filters/denominator/{appId}` persists atomic replacement and blocks unauthorized or invalid payloads.

### Tests (write first)

- [X] T035 [P] [US2] Add contract test for rules update endpoint in `tests/contract/filters/denominator-filter-config/put-denominator-rules.contract.test.ts`
- [X] T036 [P] [US2] Add contract test for update validation failures in `tests/contract/filters/denominator-filter-config/put-denominator-rules-validation.contract.test.ts`
- [X] T037 [P] [US2] Add integration test for rule replace semantics in `tests/integration/filters/denominator-filter-config/update-rules-replace.integration.test.ts`

### Implementation

- [X] T038 [P] [US2] Add denominator request schemas in `src/frontend/infrastructure/validation/denominatorFilterSchemas.ts`
- [X] T039 [P] [US2] Implement DB replace-rule queries in `src/frontend/infrastructure/persistence/database/queries/denominator-filter-queries.ts`
- [X] T040 [P] [US2] Implement memory replace-rule behavior in `src/frontend/infrastructure/persistence/memory/DenominatorFilterMemoryRepository.ts`
- [X] T041 [US2] Implement SQL replace-rule behavior in `src/frontend/infrastructure/persistence/database/DenominatorFilterDbRepository.ts`
- [X] T042 [US2] Implement rule update validation/orchestration in `src/frontend/core/application/services/DenominatorFilterService.ts`
- [X] T043 [US2] Implement rules PUT handler in `src/frontend/app/api/filters/denominator/[appId]/route.ts`
- [X] T044 [US2] Implement rule editor UI with operator filtering in `src/frontend/app/components/filters/DenominatorRuleEditor.tsx`
- [X] T045 [US2] Wire save interaction and error states in `src/frontend/app/filters/denominator/page.tsx`

**Checkpoint**: US2 independently functional and testable.

---

## Phase 5: User Story 3 - Preview Denominator Impact Before Saving (Priority: P2)

**Goal**: Users can preview current vs projected counts/revenue without persisting proposed rules.

**Independent Test**: `POST /api/filters/denominator/{appId}/preview` returns preview payload and no rule state mutation occurs.

### Tests (write first)

- [X] T046 [P] [US3] Add contract test for preview endpoint in `tests/contract/filters/denominator-filter-config/post-denominator-preview.contract.test.ts`
- [X] T047 [P] [US3] Add integration test for non-persistent preview behavior in `tests/integration/filters/denominator-filter-config/preview-readonly.integration.test.ts`

### Implementation

- [X] T048 [P] [US3] Implement preview SQL query builder in `src/frontend/infrastructure/persistence/database/queries/denominator-filter-queries.ts`
- [X] T049 [P] [US3] Implement memory preview behavior in `src/frontend/infrastructure/persistence/memory/DenominatorFilterMemoryRepository.ts`
- [X] T050 [US3] Implement SQL preview behavior in `src/frontend/infrastructure/persistence/database/DenominatorFilterDbRepository.ts`
- [X] T051 [US3] Implement preview orchestration in `src/frontend/core/application/services/DenominatorFilterService.ts`
- [X] T052 [US3] Implement preview POST route in `src/frontend/app/api/filters/denominator/[appId]/preview/route.ts`
- [X] T053 [US3] Implement preview panel component in `src/frontend/app/components/filters/DenominatorPreview.tsx`
- [X] T054 [US3] Wire preview action and warning states in `src/frontend/app/filters/denominator/page.tsx`

**Checkpoint**: US3 independently functional and testable.

---

## Phase 6: User Story 4 - Configure Adoption Settings (Priority: P2)

**Goal**: Users can read and update per-application adoption settings, including `NumeratorSource`.

**Independent Test**: `GET/PUT /api/filters/denominator/{appId}/settings` returns and persists settings with validation.

### Tests (write first)

- [X] T055 [P] [US4] Add contract test for adoption settings GET in `tests/contract/filters/denominator-filter-config/get-adoption-settings.contract.test.ts`
- [X] T056 [P] [US4] Add contract test for adoption settings PUT in `tests/contract/filters/denominator-filter-config/put-adoption-settings.contract.test.ts`
- [X] T057 [P] [US4] Add integration test for adoption settings persistence in `tests/integration/filters/denominator-filter-config/adoption-settings.integration.test.ts`

### Implementation

- [X] T058 [P] [US4] Implement adoption settings queries in `src/frontend/infrastructure/persistence/database/queries/adoption-settings-queries.ts`
- [X] T059 [P] [US4] Implement memory adoption settings repository in `src/frontend/infrastructure/persistence/memory/AdoptionSettingsMemoryRepository.ts`
- [X] T060 [US4] Implement SQL adoption settings repository in `src/frontend/infrastructure/persistence/database/AdoptionSettingsDbRepository.ts`
- [X] T061 [US4] Implement adoption settings service methods in `src/frontend/core/application/services/DenominatorFilterService.ts`
- [X] T062 [US4] Implement settings GET/PUT route in `src/frontend/app/api/filters/denominator/[appId]/settings/route.ts`
- [X] T063 [US4] Implement adoption settings panel component in `src/frontend/app/components/filters/AdoptionSettingsPanel.tsx`
- [X] T064 [US4] Wire settings read/save flow in `src/frontend/app/filters/denominator/page.tsx`

**Checkpoint**: US4 independently functional and testable.

---

## Phase 7: User Story 5 - Audit Trail for Denominator Rule Changes (Priority: P3)

**Goal**: Rule and adoption updates create traceable audit entries with appropriate scope.

**Independent Test**: Successful updates persist audit records with correct scope (`Denominator`/`Adoption`) and snapshots.

### Tests (write first)

- [ ] T065 [P] [US5] Add contract test for audit-sensitive update responses in `tests/contract/filters/denominator-filter-config/audit-response.contract.test.ts`
- [ ] T066 [P] [US5] Add integration test for denominator audit writes in `tests/integration/filters/denominator-filter-config/audit-denominator.integration.test.ts`
- [ ] T067 [P] [US5] Add integration test for adoption audit writes in `tests/integration/filters/denominator-filter-config/audit-adoption.integration.test.ts`

### Implementation

- [X] T068 [P] [US5] Add audit write query helpers for `ChangeScope` in `src/frontend/infrastructure/persistence/database/queries/denominator-filter-queries.ts`
- [X] T069 [P] [US5] Add memory audit trail behavior in `src/frontend/infrastructure/persistence/memory/DenominatorFilterMemoryRepository.ts`
- [X] T070 [US5] Implement SQL audit trail writes in `src/frontend/infrastructure/persistence/database/DenominatorFilterDbRepository.ts`
- [X] T071 [US5] Implement adoption audit writes in `src/frontend/infrastructure/persistence/database/AdoptionSettingsDbRepository.ts`
- [X] T072 [US5] Enforce audit-trigger conditions in `src/frontend/core/application/services/DenominatorFilterService.ts`

**Checkpoint**: US5 independently functional and testable.

---

## Phase 8: User Story 6 - Govern Field Choices by Denominator Model (Priority: P3)

**Goal**: Only approved model fields/operators and valid values are accepted and surfaced in UI.

**Independent Test**: Invalid field/operator/value combinations are rejected with clear validation errors; allowed combinations succeed.

### Tests (write first)

- [ ] T073 [P] [US6] Add contract test for field/operator governance in `tests/contract/filters/denominator-filter-config/rule-governance.contract.test.ts`
- [ ] T074 [P] [US6] Add integration test for operator-by-type enforcement in `tests/integration/filters/denominator-filter-config/operator-type-validation.integration.test.ts`
- [ ] T075 [P] [US6] Add integration test for non-filterable field rejection in `tests/integration/filters/denominator-filter-config/non-filterable-field.integration.test.ts`

### Implementation

- [X] T076 [P] [US6] Extend schema validation for value constraints in `src/frontend/infrastructure/validation/denominatorFilterSchemas.ts`
- [X] T077 [US6] Enforce model-governed field/operator/value checks in `src/frontend/core/application/services/DenominatorFilterService.ts`
- [X] T078 [US6] Enforce filterable-field restrictions in SQL repository path in `src/frontend/infrastructure/persistence/database/DenominatorFilterDbRepository.ts`
- [X] T079 [US6] Enforce filterable-field restrictions in memory repository path in `src/frontend/infrastructure/persistence/memory/DenominatorFilterMemoryRepository.ts`
- [X] T080 [US6] Disable invalid operator/value combinations in UI editor in `src/frontend/app/components/filters/DenominatorRuleEditor.tsx`

**Checkpoint**: US6 independently functional and testable.

---

## Phase 9: Polish & Cross-Cutting

**Purpose**: Final consistency, documentation, and end-to-end validation.

- [X] T081 [P] Update denominator API and payload examples in `specs/006-denominator-rules-config/quickstart.md`
- [X] T082 [P] Update final design consistency notes in `specs/006-denominator-rules-config/plan.md`
- [X] T083 [P] Update any contract clarifications in `specs/006-denominator-rules-config/contracts/denominator-rules-config.openapi.yaml`
- [X] T084 Run full denominator contract suite command from `tests/contract/filters/denominator-filter-config/`
- [X] T085 Run full denominator integration suite command from `tests/integration/filters/denominator-filter-config/`
- [X] T086 Run repository-wide lint/typecheck/test commands from `package.json`

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 (Setup): no dependencies.
- Phase 2 (Foundational): depends on Phase 1 and blocks all story phases.
- Phases 3-8 (User Stories): depend on Phase 2.
- Phase 9 (Polish): depends on completion of all selected story phases.

### User Story Dependencies

- US1 (P1): starts first after foundational completion.
- US2 (P1): depends on US1 read/model capability.
- US3 (P2): depends on US1 and US2 repositories/service foundations.
- US4 (P2): depends on foundational and can proceed in parallel with US3.
- US5 (P3): depends on US2 and US4 mutation flows.
- US6 (P3): depends on US1 field metadata and US2 validation flows.

### Within-Story Order

- Tests first (failing initially).
- Query/repository layer.
- Service orchestration.
- API route handlers.
- Backend complete before UI components
- UI components before page integration

---

## Parallel Execution Examples

### US1 Parallel Example

- [ ] T021 [P] [US1] Add contract test for model retrieval endpoint in `tests/contract/filters/denominator-filter-config/get-denominator-model.contract.test.ts`
- [ ] T022 [P] [US1] Add contract test for rules retrieval endpoint in `tests/contract/filters/denominator-filter-config/get-denominator-rules.contract.test.ts`
- [ ] T026 [P] [US1] Implement memory denominator model repository in `src/frontend/infrastructure/persistence/memory/DenominatorModelMemoryRepository.ts`
- [ ] T027 [P] [US1] Implement memory denominator filter repository read path in `src/frontend/infrastructure/persistence/memory/DenominatorFilterMemoryRepository.ts`

### US2 Parallel Example

- [ ] T035 [P] [US2] Add contract test for rules update endpoint in `tests/contract/filters/denominator-filter-config/put-denominator-rules.contract.test.ts`
- [ ] T036 [P] [US2] Add contract test for update validation failures in `tests/contract/filters/denominator-filter-config/put-denominator-rules-validation.contract.test.ts`
- [ ] T038 [P] [US2] Add denominator request schemas in `src/frontend/infrastructure/validation/denominatorFilterSchemas.ts`
- [ ] T040 [P] [US2] Implement memory replace-rule behavior in `src/frontend/infrastructure/persistence/memory/DenominatorFilterMemoryRepository.ts`

### US3 Parallel Example

- [ ] T046 [P] [US3] Add contract test for preview endpoint in `tests/contract/filters/denominator-filter-config/post-denominator-preview.contract.test.ts`
- [ ] T047 [P] [US3] Add integration test for non-persistent preview behavior in `tests/integration/filters/denominator-filter-config/preview-readonly.integration.test.ts`
- [ ] T048 [P] [US3] Implement preview SQL query builder in `src/frontend/infrastructure/persistence/database/queries/denominator-filter-queries.ts`
- [ ] T049 [P] [US3] Implement memory preview behavior in `src/frontend/infrastructure/persistence/memory/DenominatorFilterMemoryRepository.ts`

### US4 Parallel Example

- [ ] T055 [P] [US4] Add contract test for adoption settings GET in `tests/contract/filters/denominator-filter-config/get-adoption-settings.contract.test.ts`
- [ ] T056 [P] [US4] Add contract test for adoption settings PUT in `tests/contract/filters/denominator-filter-config/put-adoption-settings.contract.test.ts`
- [ ] T058 [P] [US4] Implement adoption settings queries in `src/frontend/infrastructure/persistence/database/queries/adoption-settings-queries.ts`
- [ ] T059 [P] [US4] Implement memory adoption settings repository in `src/frontend/infrastructure/persistence/memory/AdoptionSettingsMemoryRepository.ts`

### US5 Parallel Example

- [X] T065 [P] [US5] Add contract test for audit-sensitive update responses in `tests/contract/filters/denominator-filter-config/audit-response.contract.test.ts`
- [X] T066 [P] [US5] Add integration test for denominator audit writes in `tests/integration/filters/denominator-filter-config/audit-denominator.integration.test.ts`
- [X] T067 [P] [US5] Add integration test for adoption audit writes in `tests/integration/filters/denominator-filter-config/audit-adoption.integration.test.ts`
- [X] T069 [P] [US5] Add memory audit trail behavior in `src/frontend/infrastructure/persistence/memory/DenominatorFilterMemoryRepository.ts`

### US6 Parallel Example

- [X] T073 [P] [US6] Add contract test for field/operator governance in `tests/contract/filters/denominator-filter-config/rule-governance.contract.test.ts`
- [X] T074 [P] [US6] Add integration test for operator-by-type enforcement in `tests/integration/filters/denominator-filter-config/operator-type-validation.integration.test.ts`
- [X] T075 [P] [US6] Add integration test for non-filterable field rejection in `tests/integration/filters/denominator-filter-config/non-filterable-field.integration.test.ts`
- [X] T076 [P] [US6] Extend schema validation for value constraints in `src/frontend/infrastructure/validation/denominatorFilterSchemas.ts`

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Deliver US1 + US2 (view/edit rules) as first MVP slice.
3. Validate with contract and integration tests for US1/US2.

### Incremental Delivery

1. Add US3 (preview) after MVP baseline.
2. Add US4 (adoption settings) as next independently testable slice.
3. Add US5 (audit hardening) and US6 (governance hardening).
4. Finish with Phase 9 cross-cutting validation.

### Team Parallelization

1. One stream owns database/migrations and SQL repositories.
2. One stream owns service + API adapters.
3. One stream owns UI + integration tests.
4. Merge through contract-first checks to preserve behavior.
