# Tasks: Dashboard UI and Sub Service Line Grouping (EPIC-BQM-014)

**Input**: Design documents from `/specs/010-dashboard-ui-grouping/`
**Prerequisites**: `plan.md` (required), `spec.md` (required), `research.md`, `data-model.md`, `contracts/dashboard-ui-grouping-contract.md`, `quickstart.md`

**Tests**: Test tasks are included because the feature artifacts and constitution require deterministic unit/contract/integration verification plus Playwright end-to-end coverage for shipped user journeys.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create feature scaffolding and shared modules used by all user stories.

- [X] T001 Create dashboard API route folder scaffolding in src/frontend/app/api/dashboard/usage/
- [X] T002 [P] Create dashboard state API route folder scaffolding in src/frontend/app/api/dashboard/usage/state/
- [X] T003 [P] Create dashboard component folder scaffolding in src/frontend/components/dashboard/
- [X] T004 [P] Create dashboard domain entity scaffolding in src/frontend/core/domain/entities/DashboardUsageView.ts
- [X] T005 [P] Create dashboard DTO scaffolding in src/frontend/core/application/dto/dashboardUsageDto.ts
- [X] T006 [P] Create dashboard service scaffolding in src/frontend/core/application/services/dashboardUsageService.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement core retrieval, authorization, and aggregation infrastructure required by all stories.

**⚠️ CRITICAL**: No user story implementation should begin before this phase is complete.

- [X] T007 Implement dashboard query validation schema for subServiceLine and runId in src/frontend/lib/validation/dashboardUsageSchema.ts
- [X] T008 [P] Add dashboard scope resolver for role/application authorization in src/frontend/lib/auth/dashboardScope.ts
- [X] T009 [P] Add dashboard repository contract for grouped usage retrieval in src/frontend/core/domain/repositories/dashboardUsageRepository.ts
- [X] T010 Implement SQL-backed dashboard usage repository adapter in src/frontend/infrastructure/persistence/database/DashboardUsageDbRepository.ts
- [X] T011 [P] Implement in-memory dashboard usage repository adapter in src/frontend/infrastructure/persistence/memory/DashboardUsageMemoryRepository.ts
- [X] T012 Wire dashboard repository runtime selection in src/frontend/infrastructure/persistence/runtime/repositories.ts
- [X] T013 Implement hierarchy aggregation utility (portfolio -> Sub Service Line -> application) in src/frontend/core/application/services/dashboardGroupingService.ts
- [X] T014 Implement dashboard state resolver (ready/empty/inProgress/error) in src/frontend/core/application/services/dashboardStateService.ts
- [X] T015 Add shared dashboard response mapper for canonical envelope in src/frontend/core/application/dto/dashboardUsageMapper.ts

**Checkpoint**: Foundation ready - user stories can now proceed independently.

---

## Phase 3: User Story 1 - View Grouped Dashboard Metrics (Priority: P1) 🎯 MVP

**Goal**: Deliver grouped Application Usage dashboard with hero, KPI row, filter bar, detail hierarchy, and footer legend.

**Independent Test**: Load dashboard as authorized user and verify all five sections plus hierarchy rendering from persisted snapshots.

### Tests for User Story 1

- [X] T016 [P] [US1] Add contract test for dashboard usage response envelope in tests/contract/metrics/dashboard-usage.contract.test.ts
- [X] T017 [P] [US1] Add integration test for grouped hierarchy rendering data in tests/integration/metrics/dashboard-grouping.integration.test.ts
- [X] T018 [P] [US1] Add unit test for grouping service aggregation logic in tests/unit/frontend/core/application/services/dashboardGroupingService.test.ts
- [X] T053 [P] [US1] Add Playwright e2e test for grouped dashboard sections and hierarchy in tests/e2e/dashboard/dashboard-grouping.e2e.spec.ts

### Implementation for User Story 1

- [X] T019 [US1] Implement GET dashboard usage route handler in src/frontend/app/api/dashboard/usage/route.ts
- [X] T020 [US1] Implement dashboard usage orchestration service in src/frontend/core/application/services/dashboardUsageService.ts
- [X] T021 [P] [US1] Implement dashboard hero component in src/frontend/components/dashboard/DashboardHero.tsx
- [X] T022 [P] [US1] Implement dashboard KPI row component in src/frontend/components/dashboard/DashboardKpiRow.tsx
- [X] T023 [P] [US1] Implement dashboard filter bar component in src/frontend/components/dashboard/DashboardFilterBar.tsx
- [X] T024 [P] [US1] Implement dashboard grouped detail panel component in src/frontend/components/dashboard/DashboardDetailPanel.tsx
- [X] T025 [P] [US1] Implement dashboard footer legend component in src/frontend/components/dashboard/DashboardFooterLegend.tsx
- [X] T026 [US1] Compose Application Usage page with five required sections in src/frontend/app/dashboard/page.tsx

**Checkpoint**: User Story 1 is functional and testable independently.

---

## Phase 4: User Story 2 - Enforce Role-Scoped Visibility (Priority: P1)

**Goal**: Ensure data access and grouped output are strictly scoped by role and assigned applications.

**Independent Test**: Compare admin vs non-admin dashboard payloads and confirm only authorized application data is returned and rendered.

### Tests for User Story 2

- [X] T027 [P] [US2] Add contract test for forbidden scope and unauthorized responses in tests/contract/metrics/dashboard-usage-auth.contract.test.ts
- [X] T028 [P] [US2] Add integration test for role-scoped grouped payload visibility in tests/integration/metrics/dashboard-rbac-visibility.integration.test.ts
- [X] T029 [P] [US2] Add unit test for dashboard scope resolver behavior in tests/unit/frontend/lib/auth/dashboardScope.test.ts

### Implementation for User Story 2

- [X] T030 [US2] Enforce scope resolution before snapshot queries in src/frontend/core/application/services/dashboardUsageService.ts
- [X] T031 [US2] Enforce runId scope authorization guard in src/frontend/app/api/dashboard/usage/route.ts
- [X] T032 [P] [US2] Add structured audit-safe logging for scope decisions in src/frontend/lib/auth/dashboardScope.ts
- [X] T033 [US2] Ensure response mapper excludes unauthorized applications from groups and KPI rollups in src/frontend/core/application/dto/dashboardUsageMapper.ts

**Checkpoint**: User Stories 1 and 2 are independently functional and secure.

---

## Phase 5: User Story 3 - Handle Dashboard UI States (Priority: P2)

**Goal**: Provide explicit empty, in-progress, and error states while preserving layout stability.

**Independent Test**: Simulate no snapshots, active run with prior snapshot, and retrieval failure; verify expected state envelope and page behavior.

### Tests for User Story 3

- [X] T034 [P] [US3] Add contract test for state envelope variants in tests/contract/metrics/dashboard-usage-state.contract.test.ts
- [X] T035 [P] [US3] Add integration test for empty/inProgress/error state behavior in tests/integration/metrics/dashboard-state-behavior.integration.test.ts
- [X] T036 [P] [US3] Add unit test for dashboard state service transitions in tests/unit/frontend/core/application/services/dashboardStateService.test.ts
- [X] T054 [P] [US3] Add integration test for missing Sub Service Line fallback grouping in tests/integration/metrics/dashboard-subservice-fallback.integration.test.ts

### Implementation for User Story 3

- [X] T037 [US3] Implement GET dashboard run-state route handler in src/frontend/app/api/dashboard/usage/state/route.ts
- [X] T038 [US3] Integrate run-context hydration into dashboard usage service in src/frontend/core/application/services/dashboardUsageService.ts
- [X] T039 [US3] Implement UI state container preserving section layout in src/frontend/app/components/dashboard/DashboardStateShell.tsx
- [X] T040 [US3] Integrate state shell into dashboard page composition in src/frontend/app/dashboard/page.tsx
- [X] T055 [US3] Implement deterministic fallback label for null/empty Sub Service Line values in src/frontend/core/application/services/dashboardGroupingService.ts

**Checkpoint**: User Stories 1-3 are independently functional and stable.

---

## Phase 6: User Story 4 - Accessibility and Responsive Baseline (Priority: P2)

**Goal**: Ensure keyboard navigation, reduced-motion support, and mobile/desktop readability for dashboard interactions.

**Independent Test**: Validate keyboard-only navigation path, reduced-motion rendering behavior, and readable layout at mobile and desktop viewports.

### Tests for User Story 4

- [X] T041 [P] [US4] Add integration test for keyboard navigation across dashboard controls in tests/integration/metrics/dashboard-accessibility-keyboard.integration.test.ts
- [X] T042 [P] [US4] Add integration test for reduced-motion behavior in tests/integration/metrics/dashboard-reduced-motion.integration.test.ts
- [X] T043 [P] [US4] Add integration test for mobile/desktop responsive readability in tests/integration/metrics/dashboard-responsive-layout.integration.test.ts

### Implementation for User Story 4

- [X] T044 [US4] Implement focus management and keyboard handlers for filter/group controls in src/frontend/app/components/dashboard/DashboardFilterBar.tsx
- [X] T045 [US4] Add reduced-motion-safe transition handling in src/frontend/app/components/dashboard/dashboard.css
- [X] T046 [US4] Implement responsive layout styles for KPI cards and grouped panel in src/frontend/app/components/dashboard/dashboard.css
- [X] T047 [US4] Apply accessible labels/roles for key dashboard interactive elements in src/frontend/app/components/dashboard/DashboardDetailPanel.tsx

**Checkpoint**: All user stories are independently functional and validated.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final hardening across all stories.

- [X] T048 [P] Update dashboard API usage examples and security notes in specs/010-dashboard-ui-grouping/contracts/dashboard-ui-grouping-contract.md
- [X] T049 [P] Update implementation verification notes in specs/010-dashboard-ui-grouping/quickstart.md
- [X] T050 [P] Add dashboard feature implementation notes in specs/010-dashboard-ui-grouping/research.md
- [X] T051 Execute full dashboard-related test suite in tests/integration/metrics/
- [X] T052 Validate CI quality gates for lint, type-check, and tests using scripts/ci/validate-ci-locally.ps1
- [X] T056 Add performance verification test for SC-001 (<3s dashboard load) in tests/integration/metrics/dashboard-performance.integration.test.ts
- [X] T057 Execute Playwright dashboard e2e suite and capture evidence in tests/e2e/dashboard/README.md
- [X] T058 Add Playwright first-attempt filtering/status verification for SC-004 in tests/e2e/dashboard/dashboard-filter-status-usability.e2e.spec.ts

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies.
- **Phase 2 (Foundational)**: Depends on Phase 1 and blocks all user stories.
- **Phase 3 (US1)**: Depends on Phase 2 only.
- **Phase 4 (US2)**: Depends on Phase 2 and integrates with US1 endpoint/service behavior.
- **Phase 5 (US3)**: Depends on Phase 2 and can proceed after US1 route/service baseline is available.
- **Phase 6 (US4)**: Depends on Phase 3 page/component baseline.
- **Phase 7 (Polish)**: Depends on all selected stories being complete.

### User Story Dependencies

- **US1 (P1)**: First MVP increment and baseline for dashboard delivery.
- **US2 (P1)**: Security-critical; depends on foundational scope/repository infrastructure.
- **US3 (P2)**: Depends on existing usage route/service pipeline for state integration.
- **US4 (P2)**: Depends on dashboard components created in US1.

### Within Each User Story

- Tests should be authored first and fail before implementation.
- Contracts and validation first, then services/repositories, then routes/components.
- Story must pass its independent test criteria before moving to next priority.

---

## Parallel Opportunities

- Setup parallel tasks: T002, T003, T004, T005, T006.
- Foundational parallel tasks: T008, T009, T011.
- US1 parallel tests: T016, T017, T018, T053.
- US1 parallel components: T021, T022, T023, T024, T025.
- US2 parallel tests: T027, T028, T029.
- US3 parallel tests: T034, T035, T036, T054.
- US4 parallel tests: T041, T042, T043.
- Cross-cutting parallel tests: T056, T058.

---

## Parallel Example: User Story 1

```bash
Task T016: Contract test envelope in tests/contract/metrics/dashboard-usage.contract.test.ts
Task T017: Integration test grouping in tests/integration/metrics/dashboard-grouping.integration.test.ts
Task T018: Unit test grouping service in tests/unit/frontend/core/application/services/dashboardGroupingService.test.ts
Task T053: Playwright e2e grouped dashboard journey in tests/e2e/dashboard/dashboard-grouping.e2e.spec.ts
```

---

## Parallel Example: User Story 2

```bash
Task T027: Contract test auth failures in tests/contract/metrics/dashboard-usage-auth.contract.test.ts
Task T028: Integration test RBAC visibility in tests/integration/metrics/dashboard-rbac-visibility.integration.test.ts
Task T029: Unit test scope resolver in tests/unit/frontend/lib/auth/dashboardScope.test.ts
```

---

## Parallel Example: User Story 3

```bash
Task T034: Contract test state variants in tests/contract/metrics/dashboard-usage-state.contract.test.ts
Task T035: Integration test state behavior in tests/integration/metrics/dashboard-state-behavior.integration.test.ts
Task T036: Unit test state transitions in tests/unit/frontend/core/application/services/dashboardStateService.test.ts
Task T054: Integration test Sub Service Line fallback in tests/integration/metrics/dashboard-subservice-fallback.integration.test.ts
```

---

## Parallel Example: User Story 4

```bash
Task T041: Integration test keyboard navigation in tests/integration/metrics/dashboard-accessibility-keyboard.integration.test.ts
Task T042: Integration test reduced-motion in tests/integration/metrics/dashboard-reduced-motion.integration.test.ts
Task T043: Integration test responsive layout in tests/integration/metrics/dashboard-responsive-layout.integration.test.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1).
3. Validate US1 independently and demo grouped dashboard baseline.

### Incremental Delivery

1. Deliver US1 for baseline dashboard value.
2. Add US2 to enforce role-scoped visibility and security hardening.
3. Add US3 for resilient operational state handling.
4. Add US4 accessibility/responsive baseline.
5. Complete polish and CI validation.

### Parallel Team Strategy

1. Team completes Phase 1 and Phase 2 together.
2. After foundation:
   - Engineer A: US1 UI composition and contract route.
   - Engineer B: US2 authorization and scope enforcement.
   - Engineer C: US3 state flow and run-context integration.
3. Engineer D (or shared): US4 accessibility/responsive hardening.
4. Converge on Phase 7 test and CI evidence.

---

## Notes

- All tasks use strict format: `- [ ] T### [P?] [US?] Description with file path`.
- `[P]` marks tasks that can run in parallel without file conflicts.
- Keep API/service aggregation server-side and keep frontend filtering presentation-only.
- Do not introduce new KPI calculation logic in this epic.
