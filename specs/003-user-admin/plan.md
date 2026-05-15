# Implementation Plan: User Administration & RBAC (EPIC-BQM-002)

**Branch**: `003-user-admin` | **Date**: 2026-04-14 | **Spec**: `specs/003-user-admin/spec.md`
**Input**: Feature specification from `specs/003-user-admin/spec.md`

## Summary

Deliver the complete user administration slice for MVP: administrator-only user lifecycle management (create/deactivate), single-role assignment, per-application scope assignment (including all-applications shortcut), and strict admin-only tab/route protection. The solution uses constitution-aligned RBAC enforcement at API and UI route levels, preserves auditability for all changes, and supports incremental migration to Azure AD SSO without reworking feature APIs.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 24.x (Next.js application context) ,  SQL (Azure SQL)   
**Primary Dependencies**: Next.js, React, repository abstraction (`UserRepository`, `RoleRepository`, `UserApplicationRepository`), Azure SQL access layer, `mssql` parameterized SQL bindings; Zod for request validation, Motif web components.  
**Storage**: Dual-mode repository strategy: in-memory repository for deterministic unit tests and optional local development, SQL repository for local integration and production (`app.Users`, `app.Roles`, `app.UserApplications`, `app.Applications`)  
**Testing**: Vitest for unit/integration.  API contract/integration tests plus UI/component tests and role/route-access validation scenarios. API contract tests under `tests/contract`, integration tests under `tests/integration`  
**Target Platform**: Web application (frontend + API routes) running in local dev and Azure-hosted environments

**MVP Authentication Strategy**:
- **Develop mode**: Optional authentication. Defaults to seeded super-admin user from Epic-001 (via `DEV_SESSION_USER_ID` env var) if no auth header provided. Enables rapid iteration without mock-auth overhead.
- **Test mode**: Deterministic in-memory fixtures via Vitest setup; no authentication provider required.
- **Extended-MVP (future)**: Azure AD SSO via NextAuth; session abstraction layer (`lib/auth/session.ts`) is single-file swap, no API/UI rework needed. 
**MVP Repository Strategy**:
- **Unit tests**: MUST default to in-memory repository (`USE_INMEMORY_REPOSITORY=true`) for deterministic isolated execution per Constitution Principle IV.
- **Local development**: Supports both modes:
    - in-memory (`USE_INMEMORY_REPOSITORY=true`) for rapid iteration without SQL dependency,
    - SQL (`USE_INMEMORY_REPOSITORY=false`) for end-to-end parity with real schema/seeds.
- **Production-like execution**: MUST use SQL repository only.
**Project Type**: Web application (frontend + API)  
**Performance Goals**: Admin API responses under 500 ms p95 for standard operations (create user, role update, assignment update); admin tab load under 3 seconds under normal load.  
**Constraints**: Exactly one role per user; no hard delete; mandatory audit columns; 401/403 enforcement on every admin route; non-deprecated/non-vulnerable dependencies only; duplicate assignment prevention; audit metadata on all mutations; PR CI checks must pass before merge; all SQL access MUST use parameterized queries (`mssql` request bindings) with no dynamic string interpolation.    
**Scale/Scope**: MVP scope for one admin UI tab + user-management APIs covering 3 roles and 5 applications, with expected user population in low thousands. Epic-002 user administration scope only (US006-US009); no denominator/numerator processing changes in this feature.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Requirement (constitution.md) | Assessment | Status |
|------|-------------------------------|------------|--------|
| Principle V (Security & RBAC) | 3 roles only; admin-only user admin tab/route; one role per user; app assignment controls | Plan explicitly implements all required RBAC behaviors and route/API guards. | PASS |
| Principle IV (Test-First) | API contract/integration and feature tests before implementation | Plan includes contract and integration-first validation flow. | PASS |
| Principle I (Auditability) | Audit fields and traceability for mutations | User/role/assignment changes preserve and populate audit metadata. | PASS |
| Branching + Code Review Gate | Feature branch + PR review required | Feature remains on `002-user-administration` branch and targets PR workflow. | PASS |
| Testing Gate | Automated tests must pass before merge | CI gate already established; this feature relies on required checks before merge. | PASS |
| CI Pipeline Gate | Baseline CI must be in place before feature development | Baseline CI exists and is already part of protected-branch merge policy. | PASS |
| CD Pipeline Gate | No production CD before full MVP completion | This plan does not activate production CD and stays within MVP feature scope. | PASS |
| IaC Gate | Azure resources provisioned via Terraform | No new infrastructure provisioning in this feature; gate not violated. | PASS |

**Pre-Design Gate Result: ALL PASS.**

### Post-Design Gate Review

- Principle I - Data Integrity First: PASS. Data model includes immutable audit trail expectations and soft-delete lifecycle states.
- Principle II - Configuration-Driven Business Rules: PASS. Role and application assignment contracts externalize access configuration.
- Principle III - Validated Data Ingestion: PASS. No new ingestion behavior introduced.
- Principle IV - Test-First Development: PASS. Quickstart specifies deterministic, isolated test execution sequence.
- Principle V - Security & RBAC: PASS. Contracts enforce administrator-only management operations and strict role/application checks.
- Principle VI - Incremental Delivery: PASS. Deliverables remain bounded to user administration and RBAC enforcement.

No constitution violations require complexity justification.

## Project Structure

### Documentation (this feature)

```text
specs/003-user-admin/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── user-admin-api-contract.md
│   └── admin-ui-access-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
└── frontend/
    ├── app/
    │   ├── admin/
    │   │   └── users/
    │   └── api/
    │       └── admin/
    │           └── users/
    ├── components/admin
    └── lib/
        ├── auth/
        ├── api/
        └── types/

database/
├── schema/
│   └── app/
├── seed/
└── migrations/

tests/
├── contract/
│   └── user-administration/
├── integration/
│   └── user-administration/
└── unit/
`-- e2e/
```

**Structure Decision**: Keep current Next.js + Azure SQL architecture; implement RBAC feature behavior through API handlers, shared auth guard utilities, and admin-only UI route/components. Use the repository's existing web-application layout under `src/frontend` for admin UI + API routes, backed by existing `database/` schema artifacts, with feature-specific validation in `tests/contract` and `tests/integration`.


---

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| None | N/A | N/A |

---

## Phase 0: Research Summary

Resolved in [research.md](research.md):

| Decision Area | Chosen Approach | Resolved |
|---------------|-----------------|----------|
| Session/Auth abstraction | `getSessionUser()` abstraction for MVP now, SSO later | YES |
| Repository mode switching | Environment-driven repository selection (`USE_INMEMORY_REPOSITORY`) | YES |
| API route structure | Resource-oriented Next.js route handlers under `/api/users` | YES |
| Single-role enforcement | DB unique constraint + API upsert semantics | YES |
| Soft-delete behavior | `IsActive=false` only, no hard delete | YES |
| All-applications shortcut | `all=true` request with idempotent MERGE assignment | YES |
| Admin route protection | Middleware + component-level guard | YES |
| Audit population | API layer fills CreatedBy/UpdatedBy from session context | YES |
| Validation/injection protection | Zod input validation + parameterized SQL bindings | YES |

---

## Phase 1: Design Outputs

- [data-model.md](data-model.md) defines entities, constraints, transitions, and validation rules for Users/Roles/UserRoles/UserApplications.
- [contracts/api-users.md](contracts/api-users.md) defines endpoint contracts, payload schemas, response shapes, and error semantics.
- [contracts/ui-admin-tab.md](contracts/ui-admin-tab.md) defines admin tab visibility rules, route protection, and view behaviors.
- [quickstart.md](quickstart.md) defines local setup, API/UI validation flows, and SQL verification queries.

---

## Post-Design Constitution Check

| Gate | Status | Notes |
|------|--------|-------|
| Principle V (Security & RBAC) | PASS | Admin-only tab/route and role/application controls fully represented in design artifacts. |
| Principle IV (Test-First) | PASS | Contract/integration-first testing paths are documented. |
| Principle I (Auditability) | PASS | Mutation audit metadata is explicitly required. |
| CI Gate | PASS | Feature depends on required PR checks already established in project policy. |
| Scope/Complexity | PASS | No extra infrastructure or unrelated feature expansion introduced. |

**Post-Design Gate Result: ALL PASS.**


## Phase 0 Research Output

- Resolved naming and identifier decision: `AzureADObjectId` is the canonical identity key at API contract level; `UserId` remains internal PK.
- Resolved one-role-per-user enforcement decision: store role as a single effective value per user and enforce replacement (not additive assignment).
- Resolved "All Applications" representation decision: persist wildcard assignment `ApplicationId = "*"` with deduplication.
- Resolved admin self-role change decision: prevent removal when it would leave zero active administrators.
- Resolved authorization refresh behavior: role/assignment changes become effective on the next request (no forced logout in MVP).

## Phase 1 Design Output

- Entity and lifecycle design captured in `data-model.md`.
- API and UI authorization contracts captured in `contracts/`.
- Validation and local execution flow captured in `quickstart.md`.

## Implementation Artifacts (Planned)

- API routes under `src/frontend/app/api/admin/users/` for create, role update, assignment update, and active-state update.
- Admin UI under `src/frontend/app/admin/users/` and supporting shared components.
- RBAC middleware/hooks under `src/frontend/lib/auth/`.
- Contract/integration test suites under `tests/contract/user-administration/` and `tests/integration/user-administration/`.

## Complexity Tracking

No constitution gate violations identified.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
