# BQM-US033 — Create Baseline CI Workflow and Configure Branch Protection

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-010 (CI Pipeline — Baseline)  
> **Priority**: 0 — Trunk Prerequisite | **Phase**: Pre-MVP

---

### :bust_in_silhouette: User Story

**As a** data engineer / DevOps engineer  
**I want to** have a baseline GitHub Actions CI workflow merged into all protected trunk branches with branch protection rules enforced  
**So that** every pull request is automatically validated against lint, type-check, and unit test standards before any feature source code can be merged into the project.

---

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** a pull request is opened targeting `main`, `master`, or `develop`, **When** the CI workflow triggers, **Then** it runs lint, TypeScript type-check (`tsc --noEmit`), and unit/contract tests (`npm test`) in the `src/frontend/` directory.
- **Given** any CI job fails (lint, type-check, or tests), **When** the result is reported to GitHub, **Then** the PR merge button is blocked until the failure is resolved.
- **Given** the baseline Next.js stub project with no feature code, **When** the CI workflow runs, **Then** it passes cleanly with exit code 0.
- **Given** a developer attempts to push directly to `main`, `master`, or `develop`, **When** the push is initiated, **Then** GitHub branch protection rules reject the push and require a pull request.
- **Given** Terraform configurations exist under `infra/terraform/`, **When** CI runs, **Then** `terraform fmt -check` and `terraform validate` are included as CI steps.
- **Given** CI passes on a PR, **When** the PR is reviewed and approved, **Then** a merge is permitted; CI failure always prevents merge regardless of review status.

---

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK100] Create `.github/workflows/ci.yml` with trigger on `pull_request` targeting `main`, `master`, and `develop`
- [ ] [BQM-TK101] Add `lint` job step: `npm run lint` (ESLint) in `src/frontend/` working directory
- [ ] [BQM-TK102] Add `type-check` job step: `tsc --noEmit` in `src/frontend/` working directory
- [ ] [BQM-TK103] Add `test` job step: `npm test -- --passWithNoTests` using Jest in `src/frontend/` working directory
- [ ] [BQM-TK104] Add `terraform-validate` job step: `terraform fmt -check` and `terraform validate` in `infra/terraform/` (conditional on directory existence)
- [ ] [BQM-TK105] Pin Node.js version in CI matrix to match `src/frontend/package.json` engines field (Next.js 14 compatible)
- [ ] [BQM-TK106] Configure GitHub branch protection rules: require CI status checks, require PR review, no direct push to protected branches
- [ ] [BQM-TK107] Validate CI workflow passes cleanly on the baseline Next.js stub project
- [ ] [BQM-TK108] Document branch protection setup in `CONTRIBUTING.md` or `infra/README.md`

---

### :link: Links

- **Epic:** EPIC-BQM-010 (`Documentation/Backlog/epics/epic-010-ci-pipeline.md`)
- **Architecture:** `Documentation/ProjectSpecifications/architecture.md` — Section 4.5 (CI/CD Quality Gates — CI Pipeline)
- **Project Structure:** `Documentation/ProjectSpecifications/project-structure.md` — `.github/workflows/` folder, Section 3 (Branching Strategy)
- **Constitution:** `.specify/memory/constitution.md` — Development Workflow & Quality Gates (CI Pipeline Gate)
- **Sprint:** (Assign via Milestone)

---

### Non-Functional Requirements

- CI must complete in under 10 minutes for lint + type-check + tests on the baseline project.
- Node.js version in CI matrix must match the version in `package.json` engines field.
- No secrets required for the CI workflow at baseline (no deployment, no credentials needed).
- CI configuration must be auditable via pull request history — no manual runner modifications.

### Business Rules

- The CI workflow file is a trunk prerequisite: it MUST be the first item merged into protected branches before any feature branch is created (Constitution — CI Pipeline Gate).
- Terraform validation steps are included so IaC changes are also validated on every PR once `infra/terraform/` exists.

### Data Impact & Pipelines

- No data impact. This story provisions the quality gate infrastructure only.
- No ADF pipeline impact.


<!--
GitHub-Issue-Number: 
GitHub-Issue-URL: 
-->

<!--
AzureDevOps-WorkItem-Id: 0
AzureDevOps-WorkItem-Url: https://dev.azure.com/eygs3/attg-analytics-dashboard/_workitems/edit/0
-->
