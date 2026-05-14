# Tasks: Baseline CI Pipeline (Pre-MVP Infrastructure)

**Input**: Design documents from `/specs/002-baseline-ci-pipeline/`  
**Prerequisites**: `plan.md` (required), `spec.md` (required), `research.md`, `data-model.md`, `contracts/ci-workflow-contract.md`, `quickstart.md`

**Tests**: Included. The specification and constitution require automated test-first validation for CI behavior, contract expectations, and integration checks.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish baseline CI assets and documentation scaffolding.

- [X] T001 Create baseline workflow file in .github/workflows/ci.yml
- [X] T002 Create contribution guidance stub in CONTRIBUTING.md
- [X] T003 [P] Create CI validation scripts folder in scripts/ci/
- [X] T004 [P] Create CI test scripts folder in tests/ci/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core capabilities required before any user-story specific work.

**⚠️ CRITICAL**: No user story implementation starts before this phase is complete.

- [X] T005 Implement workflow triggers, permissions, and concurrency in .github/workflows/ci.yml
- [X] T006 [P] Implement capability detection job outputs in .github/workflows/ci.yml
- [X] T007 [P] Implement shared Node.js runtime/version env in .github/workflows/ci.yml
- [X] T008 [P] Implement dependency cache strategy with lockfile fallback in .github/workflows/ci.yml
- [X] T009 Implement skip-with-notice behavior for unavailable modules in .github/workflows/ci.yml
- [X] T010 [P] Add CI local validation helper script in scripts/ci/validate-ci-locally.ps1
- [X] T011 [P] Add workflow lint/parse validation script in scripts/ci/validate-workflow-yaml.ps1
- [X] T012 Define baseline required checks and branch policy docs in CONTRIBUTING.md

**Checkpoint**: Foundation complete - user story phases can proceed.

---

## Phase 3: User Story 1 - Code Quality Validation On PRs (Priority: P1) 🎯 MVP

**Goal**: Enforce lint, type-check, and test checks on PRs with clear pass/fail signals.

**Independent Test**: Open a PR that introduces a lint or type/test failure and verify CI reports the failing check and blocks merge.

### Tests for User Story 1

- [X] T013 [P] [US1] Create CI contract test for required jobs/check names in tests/ci/ci-required-checks.contract.ps1
- [X] T014 [P] [US1] Create CI integration test for lint-failure scenario in tests/ci/ci-lint-failure.integration.ps1
- [X] T015 [P] [US1] Create CI integration test for type-check-failure scenario in tests/ci/ci-typecheck-failure.integration.ps1
- [X] T016 [P] [US1] Create CI integration test for test-failure scenario in tests/ci/ci-test-failure.integration.ps1

### Implementation for User Story 1

- [X] T017 [US1] Implement lint job execution and skip conditions in .github/workflows/ci.yml
- [X] T018 [US1] Implement type-check job execution and skip conditions in .github/workflows/ci.yml
- [X] T019 [US1] Implement test job execution with --passWithNoTests in .github/workflows/ci.yml
- [X] T020 [US1] Add CI status-check name mapping guidance in CONTRIBUTING.md
- [X] T021 [US1] Add PR validation steps for failing-check verification in specs/002-baseline-ci-pipeline/quickstart.md

**Checkpoint**: User Story 1 independently testable and merge-gating behavior documented.

---

## Phase 4: User Story 2 - Branch Protection Enforcement (Priority: P1)

**Goal**: Prevent direct pushes and enforce required CI checks for protected branches.

**Independent Test**: Attempt direct push to protected branch and verify GitHub rejects it; verify failing checks block PR merge.

### Tests for User Story 2

- [X] T022 [P] [US2] Create branch-protection contract validation script in tests/ci/branch-protection.contract.ps1
- [X] T023 [P] [US2] Create branch-protection integration test checklist in tests/ci/branch-protection.integration.md

### Implementation for User Story 2

- [X] T024 [P] [US2] Implement branch protection automation script in scripts/ci/apply-branch-protection.ps1
- [X] T025 [P] [US2] Implement branch protection verification script in scripts/ci/verify-branch-protection.ps1
- [X] T026 [US2] Document required branch protection settings in CONTRIBUTING.md
- [X] T027 [US2] Document operational setup and rollback for branch protection in specs/002-baseline-ci-pipeline/quickstart.md

**Checkpoint**: User Story 2 independently testable with reproducible branch-protection configuration.

---

## Phase 5: User Story 3 - Build Reproducibility (Priority: P2)

**Goal**: Ensure local and CI toolchain behavior is consistent and reproducible.

**Independent Test**: Run local lint/type-check/test with the documented Node/npm setup and match CI outcomes.

### Tests for User Story 3

- [X] T028 [P] [US3] Create reproducibility contract test for Node/runtime alignment in tests/ci/runtime-alignment.contract.ps1
- [X] T029 [P] [US3] Create reproducibility integration test for npm lockfile behavior in tests/ci/lockfile-reproducibility.integration.ps1

### Implementation for User Story 3

- [X] T030 [US3] Enforce Node version setup and npm install strategy in .github/workflows/ci.yml
- [X] T031 [P] [US3] Add lockfile and fallback behavior documentation in specs/002-baseline-ci-pipeline/quickstart.md
- [X] T032 [US3] Add local reproducibility command bundle in scripts/ci/validate-ci-locally.ps1
- [X] T033 [P] [US3] Document expected local-vs-CI parity troubleshooting in specs/002-baseline-ci-pipeline/quickstart.md

**Checkpoint**: User Story 3 independently testable with documented and scriptable reproducibility flow.

---

## Phase 6: User Story 4 - Terraform Validation In CI (Priority: P2)

**Goal**: Validate Terraform formatting and syntax when IaC files are present, without breaking early phases where IaC is absent.

**Independent Test**: Add an invalid `.tf` file and verify Terraform validation fails; remove IaC folder and verify check skips cleanly.

### Tests for User Story 4

- [X] T034 [P] [US4] Create Terraform CI contract test for conditional execution in tests/ci/terraform-conditional.contract.ps1
- [X] T035 [P] [US4] Create Terraform integration test for invalid-HCL failure in tests/ci/terraform-invalid-hcl.integration.ps1

### Implementation for User Story 4

- [X] T036 [US4] Implement terraform-validate job with capability checks in .github/workflows/ci.yml
- [X] T037 [US4] Implement Terraform init/fmt/validate command flow in .github/workflows/ci.yml
- [X] T038 [P] [US4] Document Terraform conditional behavior and onboarding steps in specs/002-baseline-ci-pipeline/quickstart.md
- [X] T039 [P] [US4] Document Terraform check contract and failure expectations in specs/002-baseline-ci-pipeline/contracts/ci-workflow-contract.md

**Checkpoint**: User Story 4 independently testable with robust skip/pass/fail behavior.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final hardening and consistency checks across all stories.

- [X] T040 [P] Consolidate workflow annotations, timeouts, and notices in .github/workflows/ci.yml
- [X] T041 [P] Run and document end-to-end quickstart validation in specs/002-baseline-ci-pipeline/quickstart.md
- [X] T042 Reconcile plan, data model, and contract consistency in specs/002-baseline-ci-pipeline/plan.md
- [X] T043 Reconcile CI operational docs for final review in CONTRIBUTING.md

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 (Setup): no dependencies.
- Phase 2 (Foundational): depends on Phase 1 and blocks all user stories.
- Phases 3-6 (User Stories): depend on Phase 2.
- Phase 7 (Polish): depends on completion of desired user stories.

### User Story Dependencies

- US1 (P1): starts after Foundational; no dependency on other stories.
- US2 (P1): starts after Foundational; independent from US1 implementation but shares CI status names.
- US3 (P2): starts after Foundational; should align with US1 CI job behavior.
- US4 (P2): starts after Foundational; independent via conditional IaC capability checks.

### Within Each User Story

- Test tasks first (contract/integration), then implementation tasks.
- Workflow behavior changes before documentation updates.
- Story-specific checkpoint validation before moving to next story.

---

## Parallel Execution Opportunities

- Setup: T003 and T004 can run in parallel.
- Foundational: T006, T007, T008, T010, T011 can run in parallel after T005 starts.
- US1: T013-T016 can run in parallel; T017-T019 are sequential in one file.
- US2: T022 and T023 can run in parallel; T024 and T025 can run in parallel in separate scripts.
- US3: T028 and T029 can run in parallel; T031 and T033 can run in parallel.
- US4: T034 and T035 can run in parallel; T038 and T039 can run in parallel.
- Polish: T040 and T041 can run in parallel.

---

## Parallel Example: User Story 1

```bash
# Parallel test authoring for US1
Task T013: tests/ci/ci-required-checks.contract.ps1
Task T014: tests/ci/ci-lint-failure.integration.ps1
Task T015: tests/ci/ci-typecheck-failure.integration.ps1
Task T016: tests/ci/ci-test-failure.integration.ps1
```

## Parallel Example: User Story 2

```bash
# Parallel validation and script work for US2
Task T022: tests/ci/branch-protection.contract.ps1
Task T023: tests/ci/branch-protection.integration.md
Task T024: scripts/ci/apply-branch-protection.ps1
Task T025: scripts/ci/verify-branch-protection.ps1
```

## Parallel Example: User Story 3

```bash
# Parallel reproducibility checks for US3
Task T028: tests/ci/runtime-alignment.contract.ps1
Task T029: tests/ci/lockfile-reproducibility.integration.ps1
Task T031: specs/002-baseline-ci-pipeline/quickstart.md
Task T033: specs/002-baseline-ci-pipeline/quickstart.md
```

## Parallel Example: User Story 4

```bash
# Parallel Terraform validation tasks for US4
Task T034: tests/ci/terraform-conditional.contract.ps1
Task T035: tests/ci/terraform-invalid-hcl.integration.ps1
Task T038: specs/002-baseline-ci-pipeline/quickstart.md
Task T039: specs/002-baseline-ci-pipeline/contracts/ci-workflow-contract.md
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Complete Setup (Phase 1).
2. Complete Foundational (Phase 2).
3. Complete US1 (Phase 3) and validate merge-gating CI checks.
4. Complete US2 (Phase 4) and validate branch-protection enforcement.
5. Pause for stakeholder validation of trunk protection baseline.

### Incremental Delivery

1. Deliver MVP baseline (US1 + US2).
2. Add reproducibility hardening (US3).
3. Add conditional Terraform validation (US4).
4. Finish with polish and cross-document consistency.

### Team Parallelization

1. One engineer owns `.github/workflows/ci.yml` flow tasks.
2. One engineer owns branch-protection scripts and docs.
3. One engineer owns test harness scripts under `tests/ci/`.
4. Merge per-story increments after independent validation.

