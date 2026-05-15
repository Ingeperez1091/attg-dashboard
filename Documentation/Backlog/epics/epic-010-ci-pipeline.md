# EPIC-BQM-010 - CI Pipeline (Baseline)

> **Azure DevOps Work Item Type**: Epic  
> **ADO ID**: _TBD — to be assigned upon creation in Azure DevOps_  
> **ADO Link**: _TBD_  
> **Phase**: Pre-MVP (trunk prerequisite — must be merged before feature source-code work begins)

---

## :dart: Objective

Establish a baseline Continuous Integration (CI) pipeline on all protected trunk branches (`main`/`master`, and `develop` when used) before any feature source-code development begins. This pipeline is a mandatory quality gate, not a feature, and is the sole unblocking dependency for all source-code epics.

## :memo: Description (ADO)

Create the GitHub Actions CI workflow (`.github/workflows/ci.yml`) that automatically runs on every pull request targeting protected branches. The pipeline must enforce code quality through lint checks, TypeScript type-checking, unit/contract/integration tests, and optionally E2E tests. Branch protection rules must be configured so the CI workflow is a required status check — no PR can be merged unless all checks pass. This pipeline must be merged into trunk before any feature branch is opened.

## :chart_with_upwards_trend: Business Value

A CI pipeline catches regressions early, enforces coding standards, and ensures every pull request is verified before merging. Without it, defects accumulate across feature branches, integration cost increases dramatically, and the team has no automated quality signal. Establishing CI as the first merged artifact sets an engineering quality baseline for the entire project.

## :white_check_mark: Acceptance Criteria

- [ ] `.github/workflows/ci.yml` exists and is merged into trunk before any feature source-code PR is opened.
- [ ] CI triggers automatically on every pull request targeting `main`, `master`, and `develop`.
- [ ] CI runs: lint, TypeScript type-check (`tsc --noEmit`), unit/contract tests (`npm test`).
- [ ] All CI jobs run in the `src/frontend/` working directory with the correct Node.js version.
- [ ] CI failure blocks PR merge (enforced via branch protection rules).
- [ ] CI passes cleanly on an empty/stub Next.js project baseline.
- [ ] Branch protection rules configured: required status checks, no direct pushes to protected branches.

## :link: Dependencies

- None (this epic is the root prerequisite for all source-code epics).

## :classical_building: Architecture & Design Notes

- `Documentation/ProjectSpecifications/architecture.md` — Section 4.5 (CI/CD Quality Gates — CI Pipeline subsection)
- `Documentation/ProjectSpecifications/project-structure.md` — Section 4 (Technology Stack — CI/CD row), `.github/workflows/` folder
- `.specify/memory/constitution.md` — Development Workflow & Quality Gates (CI Pipeline Gate)

## :triangular_ruler: Non-Functional Requirements

- CI must complete in under 10 minutes for the baseline (lint + type-check + unit tests).
- Node.js version used in CI must match the version in `src/frontend/package.json` (Next.js 14 compatible).
- CI configuration must be auditable via pull request history — no manual runner modifications.
- Branch protection settings must be documented in `infra/README.md` or a dedicated `CONTRIBUTING.md`.

## :clipboard: Scope

**In Scope:** GitHub Actions CI workflow file; Branch protection configuration guidance; Node.js version matrix aligned with Next.js 14; Lint, type-check, and test job steps; Optional Playwright E2E gate (can be skipped on CI if slow).

**Out of Scope:** CD pipeline / deployment automation (EPIC-BQM-012); Azure infrastructure provisioning (EPIC-BQM-011); Application feature code.

## :book: Linked User Stories

- [ ] [BQM-US033] Create baseline CI workflow and configure branch protection

## :white_check_mark: Definition of Done (DoD)

- [ ] CI workflow merged into all protected trunk branches.
- [ ] Branch protection rules enforce required CI status checks.
- [ ] CI runs successfully on the baseline (empty/stub) project.

## :page_facing_up: PRD References

- `Documentation/ProjectSpecifications/architecture.md` — Section 4.5 (CI/CD Quality Gate)
- `.specify/memory/constitution.md` — Development Workflow & Quality Gates


<!--
GitHub-Issue-Number: 
GitHub-Issue-URL: 
-->

<!--
AzureDevOps-WorkItem-Id: 0
AzureDevOps-WorkItem-Url: https://dev.azure.com/eygs3/attg-analytics-dashboard/_workitems/edit/0
-->

