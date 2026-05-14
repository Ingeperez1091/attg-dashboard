# Quickstart: Baseline CI Pipeline

**Feature**: `002-baseline-ci-pipeline`  
**Branch**: `002-baseline-ci-pipeline`  
**Date**: 2026-04-14  
**Purpose**: Step-by-step guide to implement, validate, and activate the baseline CI pipeline and branch protection rules.

> Pipeline behavior note: the baseline workflow is tolerant for not-yet-developed modules. If frontend scripts or IaC files are missing, related jobs are skipped with notices (not failures). As modules are developed, those jobs automatically start executing.

---

## Prerequisites

Before starting, verify:
- [ ] You have repository admin access on GitHub (required to configure branch protection rules)
- [ ] The repository is hosted on GitHub (GitHub Actions availability)
- [ ] You have `git` installed and the repository cloned locally
- [ ] Node.js 24.x LTS is installed locally (`node --version` should show v24.x)
- [ ] npm 10.x is installed locally (`npm --version`)
- [ ] If validating Terraform steps: Terraform CLI installed locally (`terraform --version`)

---

## Step 1: Verify `src/frontend/` has required npm scripts

Open `src/frontend/package.json` and confirm the `scripts` section includes:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "jest"
  }
}
```

If any of these scripts are missing, the pipeline currently skips those checks and logs a notice. Add the scripts as soon as the frontend module is scaffolded:
- `"lint": "next lint"` — Next.js built-in ESLint integration
- `"test": "jest"` — requires `jest`, `@types/jest`, `jest-environment-jsdom` in `devDependencies`

**Validate locally**:
```bash
cd src/frontend
npm install
npm run lint
npm test -- --passWithNoTests
npx tsc --noEmit
```
All three commands should exit 0. If not, fix the issues before proceeding.

---

## Step 2: Create the CI Workflow File

Create `.github/workflows/ci.yml` with the following content:

```yaml
name: CI

on:
  pull_request:
    branches:
      - main
      - master
      - develop
  workflow_dispatch:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

env:
  NODE_VERSION: '24.x'

jobs:
  lint:
    name: Lint
    runs-on: eyorg_windows_latest_8_32_A
    timeout-minutes: 5
    defaults:
      run:
        working-directory: ./src/frontend
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: src/frontend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Run lint
        run: npm run lint

  type-check:
    name: TypeScript Type Check
    runs-on: eyorg_windows_latest_8_32_A
    timeout-minutes: 5
    defaults:
      run:
        working-directory: ./src/frontend
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: src/frontend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Run TypeScript type check
        run: npx tsc --noEmit

  test:
    name: Unit Tests
    runs-on: eyorg_windows_latest_8_32_A
    timeout-minutes: 10
    defaults:
      run:
        working-directory: ./src/frontend
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: src/frontend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test -- --passWithNoTests --forceExit

  terraform-validate:
    name: Terraform Validate
    runs-on: eyorg_windows_latest_8_32_A
    timeout-minutes: 3
    if: |
      contains(join(github.event.pull_request.changed_files.*.filename, ','), 'infra/terraform/')
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3

      - name: Terraform Init (no backend)
        run: terraform init -backend=false
        working-directory: ./infra/terraform

      - name: Terraform Format Check
        run: terraform fmt -check -recursive
        working-directory: ./infra/terraform

      - name: Terraform Validate
        run: terraform validate
        working-directory: ./infra/terraform
```

> **Note on terraform-validate trigger**: For this repository, the actual workflow uses capability detection and runs Terraform validation only when `infra/terraform/` exists and contains `.tf` files. This prevents failures before IaC scaffolding exists.
> ```yaml
>   - uses: dorny/paths-filter@v3
>     id: changes
>     with:
>       filters: |
>         terraform:
>           - 'infra/terraform/**'
> ```
> Then gate the terraform job on `if: steps.changes.outputs.terraform == 'true'`.

---

## Step 3: Validate CI Locally (Dry Run)

Before pushing, confirm all CI commands pass locally:

```bash
# From repo root
cd src/frontend

# Check: lint
npm run lint
# Expected: exit 0, no errors

# Check: type-check
npx tsc --noEmit
# Expected: exit 0, no type errors

# Check: tests
npm test -- --passWithNoTests --forceExit
# Expected: exit 0, "No tests found" or all tests pass

# Optional: Terraform (if infra/terraform/ exists)
cd ../../infra/terraform
terraform init -backend=false
terraform fmt -check -recursive
terraform validate
```

---

## Step 4: Push CI Workflow and Open a Pull Request

```bash
# Create the branch (already done by speckit.plan — branch 002-baseline-ci-pipeline)
git checkout 002-baseline-ci-pipeline

# Stage and commit
git add .github/workflows/ci.yml
git commit -m "feat: add baseline GitHub Actions CI workflow (EPIC-BQM-010)"

# Push to GitHub
git push origin 002-baseline-ci-pipeline
```

Open a Pull Request from `002-baseline-ci-pipeline` → `main` (or `develop`) on GitHub.

**Expected result**: CI workflow triggers automatically. All three jobs (`lint`, `type-check`, `test`) appear as pending checks on the PR within 30 seconds.

Wait for all checks to pass before proceeding.

---

## Step 5: Configure Branch Protection Rules

After CI passes on the PR, configure branch protection rules **before merging**:

### For `main` (and `master` if used):

1. Go to **Repository Settings → Branches → Add rule** (or edit existing rule for `main`).
2. Set **Branch name pattern**: `main`
3. Check: **Require a pull request before merging**
   - Set required approving reviews: `1`
   - Check: **Dismiss stale pull request approvals when new commits are pushed**
4. Check: **Require status checks to pass before merging**
   - Check: **Require branches to be up to date before merging**
  - Add required status checks: `Lint`, `TypeScript Type Check`, `Unit Tests`, `Dependency Security`
   
   > ⚠️ Status check names must match the workflow job `name:` fields exactly:
   > - `Lint`
   > - `TypeScript Type Check`
   > - `Unit Tests`
  > - `Dependency Security`
   
5. Check: **Do not allow bypassing the above settings**
6. Uncheck: **Allow force pushes**
7. Uncheck: **Allow deletions**
8. Click **Save changes**.

### Repeat for `develop`:

Same settings, with branch name pattern: `develop`.

---

## Step 6: Merge the CI Workflow PR

After branch protection rules are set:

1. Confirm all required checks are green on the PR.
2. Get 1 reviewer approval (per constitution — team member code review).
3. Merge the PR into `main` (or `develop` first if that is the trunk flow).

> ✅ **This is the milestone**: The CI workflow is now on trunk. Branch protection rules are active. No feature source code can be merged without passing lint, type-check, and tests.

---

## Step 7: Validate Protection is Enforced

Test that branch protection works:

```bash
# Attempt a direct push to main - should be rejected
git checkout main
echo "// test" >> src/frontend/app/page.tsx
git add . ; git commit -m "test direct push"
git push origin main
# Expected: ! [remote rejected] main -> main (protected branch hook declined)
```

If the push is rejected, branch protection is correctly enforced. Revert the local change:
```bash
git reset HEAD~1
git checkout src/frontend/app/page.tsx
```

---

## Step 8: Update `CONTRIBUTING.md`

Create or update `CONTRIBUTING.md` at the repository root with branch protection settings documentation:

```markdown
## Branch Protection Rules

The following branches are protected: `main`, `master`, `develop`.

**Rules enforced:**
- No direct push to protected branches (pull request required)
- 1 reviewer approval required before merge
- Stale reviews dismissed on new commits

---

## Step 9: PR Failing-Check Validation (US1)

Use this sequence to verify merge-gating behavior:

1. Create a branch and introduce one intentional lint error.
2. Open a PR to `main` or `develop`.
3. Confirm `Lint` fails and merge is blocked.
4. Fix lint, then introduce one intentional type error.
5. Confirm `TypeScript Type Check` fails and merge stays blocked.
6. Fix type error, then introduce one failing test.
7. Confirm `Unit Tests` fails and merge stays blocked.
8. Fix test and confirm all required checks pass.

---

## Step 10: Branch Protection Rollback Procedure (US2)

If an emergency requires temporary rollback:

1. Record incident ID and reason in the PR/change log.
2. Temporarily remove required checks in branch settings for affected branch.
3. Complete emergency change via reviewed PR whenever possible.
4. Re-enable required checks immediately after stabilization.
5. Run `./scripts/ci/verify-branch-protection.ps1 -Owner <owner> -Repo <repo>`.
6. Document rollback duration, approver, and restoration evidence.

---

## Step 11: End-to-End Quickstart Validation (T041)

Validate full workflow behavior:

1. Run `./scripts/ci/validate-workflow-yaml.ps1`.
2. Run `./scripts/ci/validate-ci-locally.ps1`.
3. Open a PR with no frontend/IaC and confirm skip notices (not failures).
4. Add minimal frontend scripts and confirm Lint/Type/Test jobs execute.
5. Add temporary invalid Terraform and confirm `Terraform Validate` fails.
6. Fix Terraform and confirm the check passes.
- Required CI checks must pass: `Lint`, `TypeScript Type Check`, `Unit Tests`
- Branch must be up to date with target before merge

**To restore branch protection rules** (e.g., after repository recreation):
See `infra/README.md` for the GitHub API script to restore these settings.
```

---

## Validation Checklist

After completing all steps, verify:

- [ ] `.github/workflows/ci.yml` is merged into `main` (and/or `develop`)
- [ ] Opening a new PR triggers CI automatically (all 3 jobs appear within 30 seconds)
- [ ] A PR with a lint violation has merge blocked
- [ ] A PR with a TypeScript error has merge blocked
- [ ] A PR with a failing test has merge blocked
- [ ] A direct push to `main` is rejected by GitHub
- [ ] `CONTRIBUTING.md` documents the branch protection settings
- [ ] All team members can reproduce CI results locally with `npm run lint && npx tsc --noEmit && npm test`

---

## Troubleshooting

| Problem | Solution |
|---------|---------|
| CI does not trigger on PR | Check that `branches:` list includes the target branch name; check workflow file YAML syntax |
| `missing script: lint` | Add `"lint": "next lint"` to `package.json` scripts |
| `missing script: test` | Add `"test": "jest"` to `package.json` scripts; install Jest devDependencies |
| `tsc: command not found` | Pipeline skips `type-check` if TypeScript config is not ready; once frontend is scaffolded add TypeScript in `devDependencies` |
| Type errors on clean project | Verify `tsconfig.json` has `"strict": true` and `"include"` covers the right files |
| `terraform validate` fails | Run `terraform fmt -recursive infra/terraform/` locally; fix HCL syntax errors |
| Cache not restoring | Verify `cache-dependency-path` matches the actual location of `package-lock.json` |
| Required check name mismatch | Job `name:` in YAML must exactly match what is configured in branch protection required checks |
