# Tasks: Numerator Data Ingestion API

**Input**: Design documents from `/specs/004-numerator-ingestion-api/`
**Prerequisites**: `plan.md` (required), `spec.md` (required), `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Included and required by constitution Principle IV and feature design outputs (contract + integration coverage).

**Organization**: Tasks are grouped by user story so each story is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- [X] T001 Create numerator ingestion feature folders in `src/frontend/core/application/services/`, `src/frontend/core/domain/repositories/`, `src/frontend/infrastructure/persistence/database/`, `src/frontend/infrastructure/persistence/memory/`, and `src/frontend/infrastructure/persistence/runtime/`
- [X] T002 Create test folders in `tests/contract/numerator-ingestion/` and `tests/integration/numerator-ingestion/`
- [X] T003 Create route folder and file `src/frontend/app/api/numerator/route.ts` as transport-only adapter scaffold

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish file layout and test harness alignment for clean architecture delivery.

- [X] T004 Add validation schema scaffold in `src/frontend/lib/validation/numeratorIngestionSchema.ts`
- [X] T005 Add shared numerator ingestion types in `src/frontend/core/application/dto/numeratorIngestionDto.ts`
- [X] T006 [P] Add test fixture builder for numerator payloads in `tests/integration/numerator-ingestion/fixtures.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core plumbing that must exist before user-story implementation.

**⚠️ CRITICAL**: No user story work should begin before these tasks complete.

- [X] T007 Define repository contract interface in `src/frontend/core/domain/repositories/numeratorIngestionRepository.ts`
- [X] T008 Implement SQL repository skeleton with parameterized command helpers in `src/frontend/infrastructure/persistence/database/sqlNumeratorIngestionRepository.ts`
- [X] T009 [P] Implement in-memory repository for deterministic tests in `src/frontend/infrastructure/persistence/memory/inMemoryNumeratorIngestionRepository.ts`
- [X] T010 Implement runtime repository factory selection in `src/frontend/infrastructure/persistence/runtime/numeratorIngestionRepositoryFactory.ts`
- [X] T011 [P] Add request validation schema and parser in `src/frontend/lib/validation/numeratorIngestionSchema.ts`
- [X] T012 Implement application service skeleton in `src/frontend/core/application/services/numeratorIngestionService.ts`
- [X] T013 Wire `src/frontend/app/api/numerator/route.ts` to call the application service via repository factory without embedding business logic
- [X] T014 Add shared error mapping for 400/401/403/500 responses in `src/frontend/app/api/numerator/route.ts`
- [X] T015 Add DEV session guardrail test utility that clears `DEV_SESSION_USER_ID` by default in `tests/integration/numerator-ingestion/setup.ts`

**Checkpoint**: Foundation complete. User stories can now proceed.

---

## Phase 3: User Story 1 - Submit Numerator Data Quickly (Priority: P1) 🎯 MVP

**Goal**: Accept valid authorized payloads and return staged acknowledgment without waiting for downstream processing.

**Independent Test**: Send a valid authorized payload and verify `201` acknowledgment plus staged row creation.

### Tests for User Story 1 (write first, must fail first)

- [X] T016 [P] [US1] Add contract test for `POST /api/numerator` success `201` in `tests/contract/numerator-ingestion/post-numerator-success.contract.test.ts`
- [X] T017 [P] [US1] Add integration test for successful staging persistence in `tests/integration/numerator-ingestion/post-numerator-success.integration.test.ts`
- [X] T018 [P] [US1] Add contract test proving non-blocking response semantics (no downstream wait) in `tests/contract/numerator-ingestion/post-numerator-nonblocking.contract.test.ts`
- [X] T019 [P] [US1] Add integration test proving downstream-unavailable state does not block intake response in `tests/integration/numerator-ingestion/post-numerator-nonblocking.integration.test.ts`
- [X] T020 [P] [US1] Add integration test covering successful authorized ingestion across all five in-scope applications in `tests/integration/numerator-ingestion/post-numerator-five-apps.integration.test.ts`

### Implementation for User Story 1

- [X] T021 [US1] Implement success-path orchestration and acknowledgment DTO mapping in `src/frontend/core/application/services/numeratorIngestionService.ts`
- [X] T022 [US1] Implement SQL insert into `stage.EngagementUsageRaw` with parameterized bindings in `src/frontend/infrastructure/persistence/database/sqlNumeratorIngestionRepository.ts`
- [X] T023 [US1] Implement in-memory staged record persistence parity in `src/frontend/infrastructure/persistence/memory/inMemoryNumeratorIngestionRepository.ts`
- [X] T024 [US1] Implement route success adapter behavior (`201` response mapping only) in `src/frontend/app/api/numerator/route.ts`
- [X] T025 [US1] Add service-level application activity check using app registry lookup for all in-scope applications in `src/frontend/core/application/services/numeratorIngestionService.ts`
- [X] T026 [US1] Ensure request-path code has no downstream pipeline dependency or await path in `src/frontend/core/application/services/numeratorIngestionService.ts`

**Checkpoint**: User Story 1 is independently functional and testable.

---

## Phase 4: User Story 2 - Reject Bad or Unauthorized Submissions Clearly (Priority: P2)

**Goal**: Reject malformed, unauthenticated, unauthorized, and invalid-application submissions with correct error semantics and no staging write.

**Independent Test**: Submit malformed/unauthorized requests and verify `400`/`401`/`403` with no inserted staged record.

### Tests for User Story 2 (write first, must fail first)

- [X] T027 [P] [US2] Add contract tests for `400`, `401`, and `403` in `tests/contract/numerator-ingestion/post-numerator-errors.contract.test.ts`
- [X] T028 [P] [US2] Add integration test ensuring invalid requests do not create staged rows in `tests/integration/numerator-ingestion/post-numerator-rejections.integration.test.ts`
- [X] T029 [P] [US2] Add integration test proving baseline suites run with `DEV_SESSION_USER_ID` unset in `tests/integration/numerator-ingestion/dev-session-guardrail.integration.test.ts`
- [X] T030 [P] [US2] Add contract test for injection-style payload sanitization handling in `tests/contract/numerator-ingestion/post-numerator-sanitization.contract.test.ts`
- [X] T031 [P] [US2] Add integration test ensuring malicious-looking input is treated as data and stored safely in `tests/integration/numerator-ingestion/post-numerator-sanitization.integration.test.ts`

### Implementation for User Story 2

- [X] T032 [US2] Implement schema validation failures and field-level error detail mapping in `src/frontend/lib/validation/numeratorIngestionSchema.ts`
- [X] T033 [US2] Implement authentication guard handling in `src/frontend/app/api/numerator/route.ts`
- [X] T034 [US2] Implement role/application authorization checks (`administrator`, `application_owner`, `viewer`) in `src/frontend/core/application/services/numeratorIngestionService.ts`
- [X] T035 [US2] Implement invalid-application and inactive-application rejection logic in `src/frontend/core/application/services/numeratorIngestionService.ts`
- [X] T036 [US2] Implement generic internal failure mapping (`500`) without leaking internals in `src/frontend/app/api/numerator/route.ts`
- [X] T037 [US2] Implement sanitization/normalization safeguard for injection-style input in `src/frontend/core/application/services/numeratorIngestionService.ts`

**Checkpoint**: User Story 2 works independently and preserves staging integrity.

---

## Phase 5: User Story 3 - Preserve Auditability for Each Accepted Submission (Priority: P3)

**Goal**: Persist original payload plus upload metadata (user and timestamp) for every accepted submission.

**Independent Test**: Accept a valid request and verify stored row includes untransformed payload and expected audit metadata.

### Tests for User Story 3 (write first, must fail first)

- [X] T038 [P] [US3] Add contract test for acknowledgment fields (`ingestionId`, `applicationId`, `submittedAt`, `status`) in `tests/contract/numerator-ingestion/post-numerator-ack.contract.test.ts`
- [X] T039 [P] [US3] Add integration test for audit metadata persistence (`CreatedBy`, `CreateDate`) in `tests/integration/numerator-ingestion/post-numerator-audit.integration.test.ts`

### Implementation for User Story 3

- [X] T040 [US3] Implement payload-as-is serialization and pass-through persistence behavior in `src/frontend/core/application/services/numeratorIngestionService.ts`
- [X] T041 [US3] Implement audit metadata persistence mapping in `src/frontend/infrastructure/persistence/database/sqlNumeratorIngestionRepository.ts`
- [X] T042 [US3] Implement acknowledgment timestamp and status mapping in `src/frontend/core/application/services/numeratorIngestionService.ts`
- [X] T043 [US3] Ensure route response adapter returns stable acknowledgment shape in `src/frontend/app/api/numerator/route.ts`

**Checkpoint**: User Story 3 is independently functional and auditable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final quality and cross-story hardening.

- [X] T044 [P] Add performance verification test/script for `SC-001` 5-second acknowledgment threshold in `tests/integration/numerator-ingestion/post-numerator-performance.integration.test.ts`
- [X] T045 [P] Update feature documentation in `specs/004-numerator-ingestion-api/quickstart.md` to reflect final command/test names and `DEV_SESSION_USER_ID` guardrails
- [X] T046 Run targeted suites and capture outcome notes in `specs/004-numerator-ingestion-api/quickstart.md`
- [X] T047 [P] Add regression test for duplicate submission traceability in `tests/integration/numerator-ingestion/post-numerator-duplicate-traceability.integration.test.ts`
- [X] T048 Run full quality gates (`npm run typecheck`, `npm test`) and fix any ingestion-related failures in `src/frontend/app/api/numerator/route.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: starts immediately.
- **Foundational (Phase 2)**: depends on setup; blocks all user stories.
- **User Story Phases (Phase 3-5)**: depend on foundational completion.
- **Polish (Phase 6)**: depends on completion of desired user stories.

### User Story Dependencies

- **US1 (P1)**: starts after Phase 2; no dependency on US2/US3.
- **US2 (P2)**: starts after Phase 2; functionally independent but validates same endpoint behavior.
- **US3 (P3)**: starts after Phase 2; functionally independent and focused on audit persistence/acknowledgment.

### Within Each User Story

- Tests first and failing before implementation.
- Service/repository logic before final route response wiring.
- Story-specific integration assertions before story completion.

---

## Parallel Opportunities

- Phase 2: T009 and T011 can run in parallel after T007.
- US1: T016, T017, T018, T019, and T020 parallel for test authoring.
- US2: T027, T028, T029, T030, and T031 parallel for test authoring.
- US3: T038 and T039 parallel; T041 and T042 parallel after base service logic.
- Polish: T044, T045, and T047 parallel.

---

## Parallel Example: User Story 2

```bash
# Parallel contract/integration test authoring
T027: tests/contract/numerator-ingestion/post-numerator-errors.contract.test.ts
T028: tests/integration/numerator-ingestion/post-numerator-rejections.integration.test.ts
T030: tests/contract/numerator-ingestion/post-numerator-sanitization.contract.test.ts
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1).
3. Validate `201` path, five-application support, and non-blocking staged row creation.
4. Demo/deploy MVP intake slice.

### Incremental Delivery

1. Add US2 for strict rejection semantics, security responses, and sanitization coverage.
2. Add US3 for auditability completeness.
3. Finish with performance verification and full quality gates.

### Parallel Team Strategy

1. Team completes setup/foundational together.
2. Then parallelize by story:
   - Engineer A: US1 success + non-blocking flow
   - Engineer B: US2 rejection/auth/sanitization flow
   - Engineer C: US3 auditability and ack contract

---

## Notes

- Task format follows required checklist style: `- [ ] T### [P] [US#] Description with file path`.
- `[US#]` labels are used only in user-story phases.
- Route file remains transport-only to satisfy clean architecture and constitution Principle VII.
- Tests and `DEV_SESSION_USER_ID` guardrails follow constitution Principle IV.
- FR-009/FR-010/FR-013 and SC-001/SC-005 are explicitly covered by added tasks in US1/US2 and Phase 6.
