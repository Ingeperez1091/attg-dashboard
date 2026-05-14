# Research: Baseline CI Pipeline

**Feature**: `002-baseline-ci-pipeline`  
**Branch**: `002-baseline-ci-pipeline`  
**Date**: 2026-04-14  
**Phase**: 0 — Pre-design research

All NEEDS CLARIFICATION items from the specification are resolved below. Each decision captures the chosen approach, rationale, and alternatives evaluated.

---

## Decision 1: Workflow Trigger Strategy

**Question**: Which GitHub Actions event triggers should the CI workflow use? Should it trigger on `push` to branches, `pull_request` events, or both?

**Decision**: Use `on: pull_request` targeting `main`, `master`, and `develop`. Do **not** add a `push` trigger to trunk branches.

**Rationale**:
- `pull_request` is the correct trigger for a CI gate because it fires on every commit pushed to a PR — including force-pushes and rebases — and the result is shown as a check on the PR itself, not on the merged commit.
- `push` triggers on trunk would fire after merge, making CI reactive rather than preventive. The goal is to catch failures *before* merge, not after.
- Using `pull_request` means the CI check is associated with the PR, which is what GitHub branch protection rules evaluate when determining if merging is permitted.
- Adding `push: branches: [main, master, develop]` would cause redundant CI runs on every merge commit — wasteful and unnecessary.

**Alternatives Considered**:
- `push` to trunk only: Rejected — runs after merge, not before. Does not block bad PRs.
- Both `push` and `pull_request`: Rejected — redundant runs; adds noise and queue pressure; no added safety because `pull_request` already captures all pre-merge commits.
- `workflow_dispatch` as primary: Rejected — manual trigger is not a quality gate; useful as supplement but not the primary trigger.

---

## Decision 2: Job Parallelism Strategy

**Question**: Should lint, type-check, and test jobs run in parallel or sequentially?

**Decision**: Lint, type-check, and test run **in parallel** as independent jobs. Terraform validation runs **conditionally** after the main jobs (sequential dependency not required; conditional path filter sufficient).

**Rationale**:
- Parallel jobs reduce total CI wall time. On GitHub-hosted runners, each job runs on a fresh VM, so there is no shared state to protect.
- Lint, type-check, and test are logically independent — a lint failure does not require type-check to be skipped; all three should report independently so developers see all failures at once.
- Providing complete diagnostic feedback (all three job results) on the PR check list reduces the "fix one, discover another" iteration cycle.
- Terraform validation is conditional on path filter (`infra/terraform/**`) and lightweight; it does not need to wait for Node.js jobs, nor do Node.js jobs need to wait for it.

**Alternatives Considered**:
- Sequential (lint → type-check → test): Rejected — increases wall time; hides failures in later stages when earlier checks fail, forcing multiple CI runs to discover all issues.
- Single job with sequential steps: Rejected — a single job means all steps share the same runner context and cannot be individually required or bypassed in branch protection rules. Separate jobs are needed to support per-check required status checks in branch protection settings.

---

## Decision 3: Runner Selection Strategy

**Question**: Which CI runner platform should execute the workflow? GitHub-hosted runners or EY custom runners?

**Decision**: Use the EY custom Windows runner `eyorg_windows_latest_8_32_A` for all CI jobs.

**Rationale**:
- EY custom runners provide a consistent, organization-controlled environment with pre-configured tooling aligned to EY infrastructure standards.
- The Windows runner (`eyorg_windows_latest_8_32_A`) matches local development environments where the team uses Windows machines, ensuring "it works locally, works in CI" reproducibility.
- Windows runners include Node.js, npm, Terraform, and other required tooling pre-installed, reducing CI setup time.
- Custom runners are more cost-efficient for repeated executions than per-minute GitHub-hosted runner billing.
- Using a consistent runner OS across CI and local development eliminates cross-platform issues (path separators, line endings, tool behavior differences).

**Alternatives Considered**:
- GitHub-hosted `ubuntu-22.04`: Standard CI baseline, but introduces Linux-specific behavior differences vs. Windows local development. Path separators (`/` vs `\`), bash vs PowerShell, and tool availability differ.
- EY Linux runners: Would provide consistency on one OS, but misaligned with Windows-based development machines. Developers would test on Windows locally and discover CI issues on Linux.
- macOS runners: Rejected — not aligned to team's development platform or EY infrastructure.
- Mixed runners per job (Node.js on Windows, Terraform on Linux): Rejected — introduces complexity and prevents job result comparison.

---

## Decision 4: Node.js Version Pinning

**Question**: Which Node.js version should CI use? How should it be pinned?

**Decision**: Pin to `node-version: '20.x'` using `actions/setup-node@v4`. Document the exact LTS version in workflow comments. Align with `package.json` engines field.

**Rationale**:
- Next.js 14 supports Node.js 18.17+ and is actively tested against Node.js 20.x LTS. Node 20.x is the current Active LTS (Long-Term Support) as of 2026-04-14.
- Using `'20.x'` (minor-version range) rather than an exact patch (e.g., `'20.11.1'`) allows automatic patch updates within the LTS line, reducing maintenance burden while keeping the major version stable.
- The `package.json` `engines` field for Next.js 14 projects should declare `"node": ">=18.17.0"` — Node 20.x satisfies this.
- `actions/setup-node@v4` ensures the version is exactly specified and enables npm caching, consistent across EY runners and local development environments.

**Alternatives Considered**:
- Node 18.x: Viable (Next.js 14 supports it), but Node 18.x enters security-only maintenance in April 2025. Node 20.x is the forward-compatible choice.
- Node 22.x: Rejected — not yet Active LTS during primary development; potential compatibility gaps with some Next.js plugins and tools.
- No `setup-node` (use runner default): Rejected — runner default version may change across runner image updates, causing unexpected CI failures. Explicit pinning is always safer.

---

## Decision 5: npm Install Strategy

**Question**: Should CI use `npm install` or `npm ci`? How should dependency caching work?

**Decision**: Use `npm ci` with `actions/cache@v4` keyed on `${{ hashFiles('**/package-lock.json') }}`.

**Rationale**:
- `npm ci` installs exactly what is in `package-lock.json` — reproducible, deterministic installs. This aligns with User Story 3 (Build Reproducibility).
- `npm install` may silently update packages and modify `package-lock.json`, which is wrong in CI — we want to verify the committed lockfile, not regenerate it.
- Caching with `actions/cache@v4` keyed on the lockfile hash means: if `package-lock.json` has not changed between PRs, the cache is restored, and `npm ci` runs in seconds instead of 30–60+ seconds.
- The cache key is `node-modules-${{ runner.os }}-${{ hashFiles('**/package-lock.json') }}` — invalidated when the lockfile changes (new dependencies), rebuilt cleanly on lockfile change.

**Alternatives Considered**:
- `npm install`: Rejected — does not enforce lockfile; may silently resolve different transitive dependency versions; not reproducible.
- No caching: Rejected — without caching, every PR run re-downloads all packages; increases CI time by 30–90 seconds and adds npm registry network dependency pressure.
- `yarn` or `pnpm`: N/A — the project uses npm per `package.json`; no migration needed.

---

## Decision 6: Test Command for Baseline

**Question**: The baseline Next.js stub has no tests. How do we configure `npm test` to pass cleanly without failing on "no test suites found"?

**Decision**: Use `npm test -- --passWithNoTests` in the baseline CI configuration. Once feature tests are added, the `--passWithNoTests` flag can remain (Jest exits 0 if zero tests match the pattern, not relevant once real tests exist) or be removed.

**Rationale**:
- Jest exits with code 1 by default if no test suites are found, which would cause the test job to fail on the empty baseline — before any feature code is written.
- `--passWithNoTests` tells Jest to exit 0 when no test files match the pattern. This is the correct approach for a CI baseline before tests exist.
- Once tests are written (per Constitution Principle IV — Test-First), this flag becomes a no-op but does not need to be removed immediately.
- This allows CI to be merged and enforced immediately, before any feature development starts, satisfying the Constitution CI Pipeline Gate.

**Alternatives Considered**:
- Provide a placeholder test file: Viable alternative, but adds unnecessary file. The `--passWithNoTests` flag is cleaner.
- Skip the test job on baseline: Rejected — the branch protection rule should require the test job; skipping it means the required check is never registered initially.
- Use `--forceExit` instead: Rejected — `--forceExit` addresses hanging processes, not the "no tests found" exit code issue.

---

## Decision 7: Terraform Validation Design

**Question**: When and how should Terraform validation run? Does it need terraform state or Azure credentials?

**Decision**: Terraform validation runs as a separate job with a path filter (`paths: ['infra/terraform/**']`). It uses `hashicorp/setup-terraform@v3`, runs `terraform init -backend=false` (no backend credentials needed for validate), then `terraform fmt -check -recursive` and `terraform validate`.

**Rationale**:
- `terraform validate` only checks syntax and internal consistency of `.tf` files — it does NOT require backend connectivity or Azure credentials. Using `-backend=false` skips state initialization, making it credential-free.
- `terraform fmt -check -recursive` enforces canonical HCL formatting. This is a fast, local operation that requires no external connections.
- Path filter means the job only runs when Terraform files change — avoids wasting runner minutes on every Node.js-only PR.
- No Azure service principal or subscription ID is needed for CI Terraform validation. This keeps baseline CI secrets-free.

**Alternatives Considered**:
- `terraform plan` in CI: Rejected — `plan` requires Azure credentials (subscription ID, client ID, client secret) and a configured backend. Too heavyweight for a syntax/format check; secrets management adds complexity inappropriate for baseline CI.
- Run `terraform validate` without `setup-terraform`: Requires Terraform to be pre-installed on the runner. GitHub-hosted runners do not include Terraform by default; `setup-terraform@v3` is the standard action.
- Make terraform a required check in branch protection: Only required if `infra/terraform/` files are in scope. For the baseline (no Terraform files yet), only lint/type-check/test should be required. Terraform becomes required once IaC files are added.

---

## Decision 8: Branch Protection Configuration Approach

**Question**: Branch protection rules are UI/API-based, not code. How do we make them reproducible and auditable?

**Decision**: Configure branch protection via the GitHub repository Settings UI (or GitHub CLI / REST API). Document the exact settings in `CONTRIBUTING.md`. Not managed by Terraform IaC since this is a GitHub-level setting, not an Azure resource.

**Rationale**:
- GitHub branch protection rules live at the repository level, not in Azure. Terraform's `azurerm` provider does not manage GitHub repository settings.
- The GitHub Terraform provider (`integrations/github`) could manage branch protection, but adding a GitHub provider to the IaC project adds complexity not needed at this stage. The simplest approach is manual GitHub UI setup + documentation.
- Documenting in `CONTRIBUTING.md` ensures reproducibility: any new repository can replicate the settings by following the documented steps.
- GitHub's API (`gh api`) can be used as a script for restoration, which can be added to `infra/README.md` for emergency recovery.

**Alternatives Considered**:
- GitHub Terraform provider: Viable for future automation, but introduces a second provider in `infra/terraform/`, adds GitHub token management, and is over-engineering for what is a one-time configuration.
- GitHub CLI script (`gh repo ...`): Good alternative to UI; can be documented as a reproducible setup script. Not added at baseline to keep complexity minimal.

---

## Decision 9: E2E Playwright Handling in CI

**Question**: Should Playwright E2E tests run in the baseline CI? Are they blocking?

**Decision**: Playwright E2E tests are **excluded from the baseline CI** (`ci.yml`). When E2E tests are added (per feature epics), they will run as a **separate, non-blocking job** in CI — they do not gate the merge button.

**Rationale**:
- Playwright E2E tests require a running Next.js server, browser binaries, and more setup time. On the baseline (empty stub), no E2E tests exist.
- E2E tests are inherently slower and more environment-sensitive than unit tests. Making them a blocking CI check would slow down every PR significantly.
- The constitution says "Unit and Playwright tests are required for shipped features" but does not mandate that Playwright tests block merge. They should run to surface failures for awareness, but unit/contract tests are the merge gate.
- When features add E2E tests, they run in a separate `e2e` job with a status that PR authors can see but that does not block merge. This keeps feedback loops fast.

**Alternatives Considered**:
- Block merge on E2E failure: Rejected — E2E tests are slower, more fragile (browser timing, network), and not suited as a hard merge gate. Better as an advisory signal.
- Skip E2E entirely in CI: Rejected — E2E tests must run somewhere; CI is the right place, but as a non-blocking advisory job.
- Run E2E on merge to develop only (post-merge): Possible supplement, but misses pre-merge feedback. Non-blocking on PR is the best balance.

---

## Summary of Resolved Decisions

| # | Decision | Resolved Approach |
|---|----------|------------------|
| 1 | Trigger strategy | `on: pull_request` to `main`, `master`, `develop` |
| 2 | Job parallelism | lint, type-check, test in parallel; terraform conditional |
| 3 | Node.js version | `node-version: '20.x'` via `actions/setup-node@v4` |
| 4 | npm install | `npm ci` + `actions/cache@v4` keyed on `package-lock.json` |
| 5 | Baseline test command | `npm test -- --passWithNoTests` |
| 6 | Terraform validation | `terraform init -backend=false` + `fmt -check` + `validate`; path filter |
| 7 | Branch protection | GitHub UI settings + documented in `CONTRIBUTING.md` |
| 8 | E2E Playwright | Excluded from baseline; non-blocking separate job when added |
