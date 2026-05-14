# Contributing

This repository uses a CI-first and PR-first workflow.

## Branch Protection Rules

Protected branches:
- main
- master (if present)
- develop

Required settings:
- Require a pull request before merging
- Require 1 approving review
- Dismiss stale approvals on new commits
- Require branches to be up to date before merging
- Do not allow bypassing branch protections
- Do not allow force pushes
- Do not allow branch deletion

Required CI checks (exact names):
- Lint
- TypeScript Type Check
- Unit Tests
- Dependency Security

Terraform check behavior:
- Terraform Validate is conditional and only runs when IaC files are present.
- Before IaC exists, the check is skipped with a notice.

## CI Status Mapping

Workflow file: `.github/workflows/ci.yml`

Job name to status check mapping:
- `lint` job -> `Lint`
- `type-check` job -> `TypeScript Type Check`
- `test` job -> `Unit Tests`
- `dependency-security` job -> `Dependency Security`
- `terraform-validate` job -> `Terraform Validate`

## Local Validation

Run local CI-equivalent checks:

```powershell
./scripts/ci/validate-workflow-yaml.ps1
./scripts/ci/validate-ci-locally.ps1
```

## Branch Protection Operations

Apply branch protections (requires `gh` auth and repository admin):

```powershell
./scripts/ci/apply-branch-protection.ps1 -Owner <org-or-user> -Repo <repo-name>
```

Verify branch protections:

```powershell
./scripts/ci/verify-branch-protection.ps1 -Owner <org-or-user> -Repo <repo-name>
```

Rollback guidance:
- Keep branch protection changes in pull requests where possible.
- If emergency rollback is required, temporarily remove required checks in GitHub branch protection UI, then restore after incident resolution.
- Document all emergency overrides in the pull request and team changelog.
