# CI Workflow Contract

**Feature**: `002-baseline-ci-pipeline`  
**File**: `.github/workflows/ci.yml`  
**Date**: 2026-04-14  
**Contract Type**: GitHub Actions Workflow Interface Contract

---

## Overview

This document defines the input/output contract for the baseline CI workflow. It specifies triggers, environment requirements, per-job contracts, expected outputs, and failure modes. This contract is consumed by:
- Developers opening pull requests (implicit expectation: CI will run and report)
- Branch protection rules (required status check names must match job IDs exactly)
- The CD pipeline (EPIC-BQM-012), which runs only after CI passes

The workflow is intentionally tolerant during early implementation phases: if a component is not yet available (for example `src/frontend/`, `package.json` scripts, or `infra/terraform/`), the related job is marked as skipped with a notice instead of failing the entire pipeline.

---

## 1. Trigger Contract

| Property | Value |
|----------|-------|
| Event | `pull_request` |
| Target branches | `main`, `master`, `develop` |
| Additional trigger | `workflow_dispatch` (manual re-run; optional) |
| NOT triggered by | Direct push to trunk (blocked by branch protection); tag pushes; schedule |

**Side-effect of trigger**: GitHub registers a "pending" check on the PR. Check name equals the job `name:` field in the workflow (e.g., `lint`, `type-check`, `test`).

---

## 2. Environment Contract

| Requirement | Value |
|-------------|-------|
| Runner | `eyorg_windows_latest_8_32_A` (EY custom Windows runner) |
| Node.js version | `24.x` (resolved by `actions/setup-node@v4`) |
| Capability detection | `detect-capabilities` job determines whether frontend, scripts, and Terraform files exist |
| Working directory for Node.js jobs | `./src/frontend` |
| Working directory for Terraform job | `./infra/terraform` |
| Required secrets | None (only `GITHUB_TOKEN`, auto-provided) |
| Required Azure credentials | None (CI does not deploy) |
| Required environment variables | None beyond `NODE_VERSION: '24.x'` |

---

## 3. Job Contracts

### Job: `lint`

**Purpose**: Verify all TypeScript/JavaScript files in `src/frontend/` comply with ESLint rules.

| Contract Item | Specification |
|---------------|--------------|
| Inputs | `src/frontend/` source files, `src/frontend/.eslintrc.json` |
| Command | `npm run lint` |
| Exit 0 (pass) | No ESLint violations found; or skipped with notice when frontend or lint script is unavailable |
| Exit non-0 (fail) | One or more ESLint violations found; error output includes file path, line, rule name |
| GitHub check name | `lint` |
| Required for merge | Yes |
| Timeout | 5 minutes |

**Pre-condition**: If `src/frontend/package.json` defines a `lint` script (for example `"lint": "next lint"`), the lint step executes. If missing, the job is skipped with a notice and remains green.

---

### Job: `type-check`

**Purpose**: Verify all TypeScript files in `src/frontend/` are type-valid without any type errors.

| Contract Item | Specification |
|---------------|--------------|
| Inputs | `src/frontend/` source files, `src/frontend/tsconfig.json` |
| Command | `npx tsc --noEmit` |
| Exit 0 (pass) | Zero TypeScript compiler errors; or skipped with notice when frontend or TypeScript config is unavailable |
| Exit non-0 (fail) | One or more type errors; error output includes file path, line, error code (e.g., TS2345) |
| GitHub check name | `type-check` |
| Required for merge | Yes |
| Timeout | 5 minutes |

**Pre-condition**: If `src/frontend/tsconfig.json` exists, type-check executes. If missing, the job is skipped with a notice and remains green.

---

### Job: `test`

**Purpose**: Run all Jest unit, contract, and integration tests in `src/frontend/`.

| Contract Item | Specification |
|---------------|--------------|
| Inputs | `src/frontend/` test files (`**/*.test.ts`, `**/*.spec.ts`), `src/frontend/jest.config.js` |
| Command | `npm test -- --passWithNoTests` |
| Exit 0 (pass) | All found tests pass; or zero test files found (with `--passWithNoTests`); or skipped with notice when test script is unavailable |
| Exit non-0 (fail) | One or more test assertions fail; or Jest configuration error |
| GitHub check name | `test` |
| Required for merge | Yes |
| Timeout | 10 minutes |
| Coverage | Not enforced at CI level for baseline; 80% minimum for business logic per constitution (enforced via Jest coverage thresholds in `jest.config.js` when feature tests are added) |

**Pre-condition**: If `src/frontend/package.json` defines a `test` script (for example `"test": "jest"`), test execution runs. If missing, the job is skipped with a notice and remains green.

---

### Job: `dependency-security`

**Purpose**: Enforce dependency and workflow reference security policy by failing when insecure dependency states are detected.

| Contract Item | Specification |
|---------------|--------------|
| Inputs | `.github/workflows/*.yml`, `src/frontend/package*.json` (if present), `infra/terraform/*.tf` (if present) |
| Commands | workflow action reference checks, `npm audit --audit-level=high`, Terraform provider version constraint checks |
| Exit 0 (pass) | No workflow action ref policy violations; no npm high/critical vulnerabilities; Terraform provider constraints present (or sections skipped with notice when not available yet) |
| Exit non-0 (fail) | Floating action refs, missing action versions, npm high/critical vulnerabilities, or missing Terraform provider constraints |
| GitHub check name | `dependency-security` |
| Required for merge | Yes |
| Timeout | 10 minutes |

**Pre-condition**: Workflow reference checks always run. npm audit runs only when `src/frontend/package.json` exists. Terraform provider checks run only when `infra/terraform/` exists with `.tf` files.

---

### Job: `terraform-validate` (conditional)

**Purpose**: Verify Terraform HCL files in `infra/terraform/` are syntactically valid and canonically formatted.

| Contract Item | Specification |
|---------------|--------------|
| Inputs | Files under `infra/terraform/**` |
| Capability rule | Runs only when `infra/terraform/` exists and contains `.tf` files |
| Commands | `terraform init -backend=false`, `terraform fmt -check -recursive`, `terraform validate` |
| Exit 0 (pass) | Format matches canonical HCL; no syntax errors in `.tf` files; or skipped with notice when IaC is not yet available |
| Exit non-0 (fail) | Format differs from canonical (run `terraform fmt` locally to fix); or HCL syntax error |
| GitHub check name | `terraform-validate` |
| Required for merge | Not at baseline (advisory); becomes required once IaC files are committed |
| Timeout | 3 minutes |
| Azure credentials required | No — `terraform init -backend=false` skips state initialization |

**Pre-condition**: `infra/terraform/` directory must contain at least one `.tf` file for Terraform validation to execute. If missing, the job is skipped with a notice.

---

### Job: `e2e` (deferred)

**Purpose**: Run Playwright end-to-end tests against a locally started Next.js server.

| Contract Item | Specification |
|---------------|--------------|
| Status | **Not included in baseline** `ci.yml`; added when feature E2E tests exist |
| GitHub check name | `e2e` |
| Required for merge | No (advisory / non-blocking) |
| Timeout | 15 minutes |

---

## 4. Output Contract

After CI completes, GitHub reports the following checks on the PR:

| Check Name | Required for Merge | Reported As |
|------------|--------------------|-------------|
| `lint` | Yes | ✅ Pass / ❌ Fail / ⏭️ Skipped |
| `type-check` | Yes | ✅ Pass / ❌ Fail / ⏭️ Skipped |
| `test` | Yes | ✅ Pass / ❌ Fail / ⏭️ Skipped |
| `dependency-security` | Yes | ✅ Pass / ❌ Fail / ⏭️ Skipped |
| `terraform-validate` | Conditional (see above) | ✅ Pass / ❌ Fail / ⏭️ Skipped |

**Merge prerequisite**: `lint`, `type-check`, `test`, and `dependency-security` checks must complete successfully. In early phases some sub-checks within jobs may show skip notices when components are not yet scaffolded; as features are implemented, those checks transition from skipped to enforced execution.

---

## 5. Failure Modes

| Failure Mode | Job Affected | Developer Action |
|---|---|---|
| ESLint rule violation | `lint` | Fix the ESLint error; push a new commit to the PR |
| TypeScript type error | `type-check` | Fix the type error; run `tsc --noEmit` locally to confirm; push |
| Failing Jest test | `test` | Fix or update the failing test; run `npm test` locally; push |
| HCL format mismatch | `terraform-validate` | Run `terraform fmt -recursive infra/terraform/`; commit result; push |
| HCL syntax error | `terraform-validate` | Fix the Terraform syntax error; validate locally; push |
| IaC absent (`infra/terraform` missing) | `terraform-validate` | Expected skip with notice; no failure until IaC is introduced |
| npm install failure | `lint`, `type-check`, `test` | Check `package-lock.json` for integrity; check npm registry status; re-run |
| npm high/critical vulnerability found | `dependency-security` | Run `npm audit`, apply secure upgrades, and re-run CI |
| Floating/missing workflow action version | `dependency-security` | Pin action to an explicit immutable tag/commit (avoid `main`, `master`, `latest`) |
| Missing Terraform provider constraints | `dependency-security` | Add `required_providers` with explicit version constraints in Terraform configuration |
| Missing `lint` script | `lint` | Job is skipped with notice; add `"lint": "next lint"` when frontend is ready |
| Missing `test` script | `test` | Job is skipped with notice; add `"test": "jest"` when tests are introduced |
| CI runner timeout | any | Re-run the workflow manually; investigate slow steps |

---

## 6. Contract Guarantees

The CI workflow guarantees the following to downstream consumers:

1. **To branch protection rules**: Job names match exactly `lint`, `type-check`, `test`, and `dependency-security` — these are the names to use in required status check configuration.
2. **To developers**: Required jobs run in parallel where possible; total wall time remains bounded by CI timeout settings.
3. **To the CD pipeline (EPIC-BQM-012)**: CD configuration should use `needs: [lint, type-check, test, dependency-security]` to depend on CI completion. CD does NOT re-run CI; it depends on the same workflow run status.
4. **To security auditors**: Dependency lifecycle/security controls are enforced in CI (action ref safety, npm audit, Terraform provider constraint checks). No Azure credentials, no application secrets, and no environment secrets required. The only token used is the auto-provisioned `GITHUB_TOKEN` (read-only, scoped to the repository).

---

## 7. Workflow Annotations Reference

Key GitHub Actions annotations used in this workflow:

| Annotation | Effect |
|------------|--------|
| `permissions: contents: read` | Restricts GITHUB_TOKEN to read-only; no write operations |
| `concurrency: ci-${{ github.ref }}` | Only one CI run per branch at a time; cancels stale in-progress runs |
| `timeout-minutes: 10` | Kills stuck jobs after 10 minutes; prevents runaway billing |
| `continue-on-error: false` (default) | Any failure marks the job as failed and blocks merge |
