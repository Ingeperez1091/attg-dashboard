# Feature Specification: Baseline CI Pipeline (Pre-MVP Infrastructure)

**Feature Branch**: `002-baseline-ci-pipeline`  
**Created**: 2026-04-14  
**Status**: Ready  
**Input**: User description: "epic-010-ci-pipeline — Establish baseline CI pipeline as trunk prerequisite. Follow constitution.md and related specifications."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — DevOps Engineer Validates Code Quality on Pull Requests (Priority: P1)

**As a** DevOps engineer / team lead  
**I want to** have every pull request automatically validated against lint, TypeScript type-checking, and unit tests  
**So that** no code with quality issues, type errors, or failing tests can be merged into the protected trunk branches without explicit detection and team awareness.

**Why this priority**: This is P1 because CI is the ROOT blocker for all source-code development. Without CI, the team has no automated quality signal, and defects accumulate exponentially. This unblocks the entire development roadmap.

**Independent Test**: A developer can open a PR with a lint violation or test failure, watch CI run automatically, and see the PR merge button blocked until the issue is fixed. This delivers immediate value: code quality enforcement without manual review burden duplication.

**Acceptance Scenarios**:

1. **Given** a PR is opened with a TypeScript syntax error, **When** the CI workflow triggers, **Then** the type-check job fails and the PR merge button is blocked.
2. **Given** a PR is opened with a passing test suite, **When** CI completes, **Then** all checks pass and the merge button is enabled.
3. **Given** a PR is opened targeting `main`, `master`, or `develop`, **When** the push event occurs, **Then** the CI workflow triggers automatically within 30 seconds.
4. **Given** CI fails on a PR, **When** a developer fixes the code and pushes a new commit, **Then** CI re-runs automatically and completes within 10 minutes.
5. **Given** the baseline Next.js stub (no feature code), **When** CI runs, **Then** lint, type-check, and test jobs all pass cleanly.

---

### User Story 2 — Team Member Enforces Branch Protection (Priority: P1)

**As a** team lead / repository administrator  
**I want to** have branch protection rules that enforce CI as a required status check and prevent direct pushes to `main`, `develop`, and `master`  
**So that** all code changes to protected trunk branches pass through CI validation, and no commits can bypass the quality gate even with admin permissions (unless explicitly overridden during emergency hotfix procedures).

**Why this priority**: Branch protection is the enforcement mechanism that makes CI a blocking gate. Without protection rules, developers can bypass CI and merge failing code. This ensures consistency and accountability.

**Independent Test**: An admin can configure GitHub branch protection rules, attempt a direct push to `main`, and verify that GitHub rejects the push. This delivers the enforcement guarantee independent of the CI workflow itself.

**Acceptance Scenarios**:

1. **Given** branch protection rules are configured on `main`, **When** a developer attempts a direct push (no PR), **Then** GitHub rejects the push with a "protected branch" error.
2. **Given** CI is configured as a required check in the branch protection rules, **When** a PR is opened with failing CI, **Then** the merge button remains blocked even after code review approval.
3. **Given** branch protection allows dismissal of stale reviews, **When** a new commit is pushed to a PR, **Then** previous approvals are invalidated and must be re-requested.
4. **Given** an admin reviews and approves a failing PR, **When** the admin attempts to merge-override, **Then** GitHub still requires the CI check to pass or admin explicitly bypasses via protected merge state change.
5. **Given** the configuration is documented in `CONTRIBUTING.md`, **When** a new team member reads the doc, **Then** they understand which branches are protected, what triggers CI, and what "required status" status checks mean.

---

### User Story 3 — Build Reproducibility on CI Baseline (Priority: P2)

**As a** developer  
**I want to** know that the exact Node.js version, lint rules, and test runner configuration in CI exactly match what I run locally  
**So that** the "it works on my machine, but fails in CI" problem is eliminated, and CI failure diagnosis is straightforward.

**Why this priority**: P2 because it's a quality-of-life improvement for the team. P1 is achieved if CI fails and blocks; P2 is achieved when CI failures are predictable and reproducible locally. This reduces debugging friction.

**Independent Test**: A developer can run `npm install && npm run build && npm run lint && npm test` locally, get the same results as CI, and confirm that Node.js version and toolchain are aligned. Reproducibility can be verified independently.

**Acceptance Scenarios**:

1. **Given** the Node.js version in CI matrix, **When** compared to `src/frontend/package.json` engines field, **Then** they are identical (e.g., both specify Node 20.x LTS).
2. **Given** the ESLint and TypeScript configuration files, **When** they are run locally and in CI, **Then** both produce the same pass/fail result on any code change.
3. **Given** Jest test configuration, **When** tests are run with `npm test` locally and in CI, **Then** the same tests pass/fail; no flaky or environment-dependent tests.
4. **Given** `.npmrc` or `package-lock.json` in the repository, **When** `npm ci` is run in both local and CI environments, **Then** identical package versions are installed.
5. **Given** a CI failure in the `type-check` job, **When** a developer runs `tsc --noEmit` locally, **Then** they see the same TypeScript error immediately without rebuilding the repository.

---

### User Story 4 — Terraform Infrastructure Validation in CI (Priority: P2)

**As a** DevOps engineer  
**I want to** have `terraform fmt -check` and `terraform validate` run on every PR that modifies files under `infra/terraform/` once it be created and defined according to its respective specification 
**So that** Infrastructure as Code changes are validated for format and syntax before merge, reducing the risk of failed `terraform apply` due to configuration errors.

**Why this priority**: P2 because IaC is important but not the initial blocker (P1 is the Node.js app CI). Once the CI baseline is in place, IaC checks can be added as a conditional job.

**Independent Test**: A developer can modify `infra/terraform/main.tf` deliberately (add invalid syntax), open a PR, and watch CI's terraform validation job fail independently of the Node.js build jobs. The check delivers value on its own.

**Acceptance Scenarios**:

1. **Given** a PR modifies `infra/terraform/variables.tf` with improper HCL syntax, **When** CI runs, **Then** the `terraform validate` job fails and reports the error.
2. **Given** a PR reformats Terraform code with `terraform fmt`, **When** CI runs `terraform fmt -check`, **Then** the check passes if formatting matches the standard.
3. **Given** `infra/terraform/` does not exist, **When** CI runs, **Then** the terraform validation job is skipped (conditional) without failing the overall workflow.
4. **Given** a PR modifies `src/frontend/` but not `infra/terraform/`, **When** CI completes, **Then** terraform validation may still run but does not block on unrelated changes if conditional logic is in place.

---

### Edge Cases

- **What if CI takes longer than 10 minutes?** The workflow should log progress; if consistent slowness occurs, the team should investigate bottlenecks (slow npm install, slow build, slow tests) and optimize or distribute jobs.
- **What if a developer's local Node.js version differs from CI?** The mismatch should be caught quickly when they see CI pass but their local type-check fails (or vice versa). Documentation should make Node.js version pinning clear.
- **What if a test flakes intermittently in CI but passes locally?** The workflow should retry failed tests (configurable retry logic) to reduce false negatives. If flakiness persists, tests should be marked as pending and investigated separately (not blocking merge).
- **What if branch protection rules are not enforced and someone bypasses CI?** GitHub audit logs will record the bypass. The constitution requires the team to review and enforce these rules during code review — this is a process control, not a technical control.
- **What if a PR is stuck in "pending" because the CI runner is down?** GitHub Actions reliability is very high; if the runner crashes, the PR remains pending and the team should manually re-run the workflow or troubleshoot the infrastructure.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The CI workflow MUST automatically trigger on every pull request targeting `main`, `master`, and `develop` branches without requiring manual intervention.
- **FR-002**: The CI workflow MUST run the following checks in sequence or in parallel: lint (`npm run lint` via ESLint), TypeScript type-check (`tsc --noEmit`), and unit/contract tests (`npm test`).
- **FR-003**: All CI jobs MUST run in the `src/frontend/` working directory with the Node.js version pinned to the version specified in `src/frontend/package.json` (Next.js 14 compatible, e.g., Node 20.x LTS).
- **FR-004**: When any CI job fails (lint violation, type error, or test failure), the CI workflow MUST report failure to GitHub, and the PR MUST NOT be mergeable until the failure is resolved.
- **FR-005**: CI MUST pass cleanly when run on an empty or stub Next.js 14 project baseline with no feature code, confirming the workflow configuration is syntactically valid.
- **FR-006**: The CI workflow configuration MUST be stored in `.github/workflows/ci.yml` and MUST be version-controlled in the repository, making it auditable and reviewable like any other code.
- **FR-007**: GitHub branch protection rules MUST be configured to make CI status checks required for merge; direct pushes to protected branches MUST be denied.
- **FR-008**: The CI workflow MUST complete from trigger to report-back in under 10 minutes on the baseline project (no feature code), ensuring developer feedback is fast.
- **FR-009**: CI MUST support optional Playwright E2E tests; if E2E tests exist, they MUST run after unit tests, but E2E test failures MAY be non-blocking if configured as a separate job status.
- **FR-010**: Terraform format and validation checks MUST be included as a conditional CI job (run only if `infra/terraform/**` files are modified) using `terraform fmt -check` and `terraform validate`.
- **FR-011**: When CI completes (success or failure), GitHub MUST display a check status in the PR with a link to the full workflow run logs for debugging.
- **FR-012**: Lint, type-check, and test jobs MUST cache npm dependencies between runs to reduce CI duration on repeated PRs.

### Non-Functional Requirements

- **NFR-001**: CI workflow execution time MUST be under 10 minutes on the baseline; if any job takes longer than 5 minutes, the team should investigate optimization (caching, parallelization, test filtering).
- **NFR-002**: Node.js version in CI MUST be pinned to a specific LTS release (e.g., `20.11.1`) and MUST be documented in `.github/workflows/ci.yml` and `infra/README.md` so updates are deliberate.
- **NFR-003**: CI configuration MUST be auditable: any changes to `.github/workflows/ci.yml` are visible in pull request diffs and must be reviewed like application code.
- **NFR-004**: Branch protection rules MUST be configured via GitHub API or UI settings, not in code; the configuration MUST be documented in `CONTRIBUTING.md` or `infra/README.md` for reproducibility.
- **NFR-005**: CI MUST be resilient to transient failures (e.g., npm registry temporary downtime); the workflow should retry failed steps where appropriate.
- **NFR-006**: CI logs MUST not expose secrets or credentials (only references like `*** (redacted) ***`).

### Key Entities

- **GitHub Actions Workflow**: The `.github/workflows/ci.yml` file defining the CI pipeline.
- **Branch Protection Rules**: Repository settings enforcing required CI status checks on protected branches.
- **Node.js Runtime**: Pinned version matching Next.js 14 compatibility and `package.json` engines.
- **Lint Configuration**: `.eslintrc.json` or equivalent defining coding standards.
- **TypeScript Configuration**: `tsconfig.json` defining type-check strictness.
- **Test Configuration**: `jest.config.js` defining test discovery and reporting.

## Success Criteria *(mandatory)*

Measurable, technology-agnostic outcomes this feature must deliver:

- **SC-001**: **100% of pull requests targeting protected branches MUST pass CI before merge.** Verification: Review GitHub PR history; all merged PRs show green ✓ from CI.
- **SC-002**: **CI workflow MUST complete in under 10 minutes on the baseline project, 95% of the time.** Verification: Review GitHub Actions history; median and 95th percentile < 10 minutes.
- **SC-003**: **Zero regressions introduced by CI configuration.** Verification: After merge, no developers report blocked CIerrors unrelated to actual code issues.
- **SC-004**: **100% of developers can reproduce CI results locally within 5 minutes.** Verification: New developer onboards, follows setup, runs `npm install && npm run lint && npm test`, confirms match.
- **SC-005**: **Branch protection rules enforced with zero bypasses** (except documented emergencies). Verification: GitHub audit logs show no direct pushes to protected branches.
- **SC-006**: **All required checks visible in PR UI and block merge if failed.** Verification: Open PR with test failure, confirm merge button blocked until fixed.

## Assumptions

- **ASM-001**: Node.js LTS is available in GitHub Actions runners; no custom runner setup needed.
- **ASM-002**: The team enforces CI rules via GitHub settings, not by honor system.
- **ASM-003**: Terraform is available in GitHub Actions or via pre-built action (`hashicorp/setup-terraform@v3`).
- **ASM-004**: Repository is hosted on GitHub; GitHub Actions is the CI/CD platform per constitution.
- **ASM-005**: Branch names are consistently `main`, `master`, or `develop`.
- **ASM-006**: npm packages are publicly available; no private registries required.
