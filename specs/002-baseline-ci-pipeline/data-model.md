# Data Model: Baseline CI Pipeline

**Feature**: `002-baseline-ci-pipeline`  
**Branch**: `002-baseline-ci-pipeline`  
**Date**: 2026-04-14  
**Phase**: 1 — Design

> This document describes the **configuration model** for the CI pipeline. There are no database entities involved — the "data" here is the structured configuration of the workflow, its jobs, inputs, and outputs, and the branch protection rule settings.

---

## 1. Workflow File Model

### Entity: `ci.yml` (GitHub Actions Workflow)

**File**: `.github/workflows/ci.yml`  
**Purpose**: Defines all CI jobs, triggers, and runtime configuration.

| Field | Value | Notes |
|-------|-------|-------|
| `name` | `CI` | Displayed in GitHub Actions UI |
| `on.pull_request.branches` | `[main, master, develop]` | Triggers on PR to any protected trunk |
| `on.workflow_dispatch` | (optional) | Allows manual CI trigger for debugging |
| `defaults.run.working-directory` | `./src/frontend` | All Node.js job steps run here |
| `env.NODE_VERSION` | `'24.x'` | Pinned at top-level for easy update |

---

## 2. Job Definitions

### Job: `lint`

| Field | Value |
|-------|-------|
| `runs-on` | `eyorg_windows_latest_8_32_A` |
| `working-directory` | `./src/frontend` |
| Steps | `checkout`, `setup-node (24.x)`, `cache npm`, `npm ci`, `npm run lint` |
| Branch protection required | Yes |

### Job: `type-check`

| Field | Value |
|-------|-------|
| `runs-on` | `eyorg_windows_latest_8_32_A` |
| `working-directory` | `./src/frontend` |
| Steps | `checkout`, `setup-node (24.x)`, `cache npm`, `npm ci`, `npx tsc --noEmit` |
| Branch protection required | Yes |

### Job: `test`

| Field | Value |
|-------|-------|
| `runs-on` | `eyorg_windows_latest_8_32_A` |
| `working-directory` | `./src/frontend` |
| Steps | `checkout`, `setup-node (24.x)`, `cache npm`, `npm ci`, `npm test -- --passWithNoTests` |
| Branch protection required | Yes |

### Job: `terraform-validate` (conditional)

| Field | Value |
|-------|-------|
| `runs-on` | `eyorg_windows_latest_8_32_A` |
| `working-directory` | `./infra/terraform` |
| Path filter | `paths: ['infra/terraform/**']` |
| Steps | `checkout`, `setup-terraform (v3)`, `terraform init -backend=false`, `terraform fmt -check -recursive`, `terraform validate` |
| Branch protection required | No (advisory — added to required checks once IaC is committed) |

### Job: `e2e` (deferred — added when feature E2E tests exist)

| Field | Value |
|-------|-------|
| `runs-on` | `eyorg_windows_latest_8_32_A` |
| Status | Non-blocking (separate job not listed in required checks) |
| Steps | `checkout`, `setup-node`, `npm ci`, `npm run build`, `npx playwright test` |
| Branch protection required | No |

---

## 3. npm Cache Configuration

| Field | Value |
|-------|-------|
| Action | `actions/cache@v4` |
| `key` | `node-modules-${{ runner.os }}-${{ hashFiles('**/package-lock.json') }}` |
| `restore-keys` | `node-modules-${{ runner.os }}-` |
| `path` | `~/.npm` |
| Invalidation trigger | Any change to `package-lock.json` |

---

## 4. Branch Protection Rules Model

**Configured via**: GitHub repository Settings → Branches → Add/Edit Rule  
**Documented in**: `CONTRIBUTING.md`

### Rule: `main` (and `master` if used)

| Setting | Value | Rationale |
|---------|-------|-----------|
| Branch name pattern | `main` | Exact match on primary trunk |
| Require pull request before merging | ✅ Yes | No direct pushes permitted |
| Required reviews | 1 | At least 1 reviewer per constitution |
| Dismiss stale pull request approvals | ✅ Yes | New commits re-require review |
| Require status checks to pass | ✅ Yes | CI is the enforcement mechanism |
| Required status checks | `lint`, `type-check`, `test`, `dependency-security` | These 4 jobs must pass |
| Require branches to be up to date | Recommended ✅ | Prevents merging behind-trunk branches |
| Do not allow bypassing the above | ✅ Yes | Admins included (except documented emergency) |
| Allow force pushes | ❌ No | Immutable trunk history |
| Allow deletions | ❌ No | Trunk branches cannot be deleted |

### Rule: `develop` (same settings as `main`)

| Setting | Value |
|---------|-------|
| Branch name pattern | `develop` |
| Required status checks | `lint`, `type-check`, `test`, `dependency-security` |
| All other settings | Same as `main` rule above |

---

## 5. Workflow Configuration State Machine

```
PR Opened / Commit Pushed to PR
        │
        ▼
CI Workflow Triggered (pull_request event)
        │
        ├──► [lint job] ─────────────────────────────────────────────────┐
        │                                                                │
        ├──► [type-check job] ──────────────────────────────────────────┤──► All Pass? ──► Merge Permitted
        │                                                                │
        ├──► [test job] ─────────────────────────────────────────────────┘    Any Fail? ──► Merge Blocked
        │
        └──► [terraform-validate job] (conditional: infra/terraform/** changed)
                        │
                        └──► Pass/Fail reported separately (advisory at baseline)
```

---

## 6. Secrets Model

The baseline CI workflow requires **zero application secrets**. All required tokens are auto-provided by GitHub Actions.

| Secret | Source | Used By | Required |
|--------|--------|---------|----------|
| `GITHUB_TOKEN` | GitHub auto-provision (read-only) | `actions/checkout@v4` | Yes (automatic) |
| Azure credentials | N/A | CI does not deploy | No |
| npm registry token | N/A | Public packages only | No |

**Security note**: No secrets storage setup required for CI. Azure credentials are only needed for the CD pipeline (EPIC-BQM-012), which is a separate workflow.

---

## 7. Configuration Files Referenced (existing)

| File | Purpose in CI | Owner |
|------|---------------|-------|
| `src/frontend/package.json` | Defines `lint`, `test`, `build` scripts; defines `engines.node` | Application code |
| `src/frontend/tsconfig.json` | TypeScript strict config used by `tsc --noEmit` | Application code |
| `src/frontend/.eslintrc.json` | ESLint rules used by `npm run lint` | Application code |
| `src/frontend/jest.config.js` | Jest test runner configuration | Application code |
| `infra/terraform/*.tf` | Validated by `terraform fmt -check` and `terraform validate` | IaC (EPIC-BQM-011) |

> **Note**: If `src/frontend/package.json` does not yet define `lint`, `test`, or `build` scripts, CI will fail on those jobs. These scripts must exist (even if minimal) before CI is merged. Baseline stubs are documented in `quickstart.md`.

---

## 8. Job Execution Time Targets

| Job | Target Duration | Acceptable Maximum |
|-----|----------------|--------------------|
| `lint` | < 60 seconds | 3 minutes |
| `type-check` | < 90 seconds | 3 minutes |
| `test` | < 60 seconds (baseline — no tests) | 5 minutes (with unit tests) |
| `terraform-validate` | < 30 seconds | 2 minutes |
| Total wall time (parallel) | < 3 minutes (baseline) | 10 minutes (with tests) |
