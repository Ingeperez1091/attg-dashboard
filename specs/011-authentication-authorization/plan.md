# Implementation Plan: EPIC-BQM-005 Authentication and Authorization

**Branch**: `011-authentication-authorization` | **Date**: 2026-05-08 | **Spec**: `specs/011-authentication-authorization/spec.md`
**Input**: Feature specification from `specs/011-authentication-authorization/spec.md`

## Summary

Deliver the Extended-MVP authentication and authorization slice by enforcing Azure AD SSO-backed session requirements, role-based route/action control, and strict application-scoped data visibility across API and dashboard surfaces. The implementation approach centralizes security decisions in existing auth/session guard layers (`lib/auth`) and application services, maintains thin route adapters, and ensures consistent 401/403 semantics with non-leaky error responses. Existing user-role-application domain tables remain authoritative; no new role types or business-scope changes are introduced.

## Technical Context

**Language/Version**: TypeScript 5.x (Next.js App Router)  
**Primary Dependencies**: Next.js 15, React 18, existing auth/session guard modules, Zod request validation, `mssql` parameterized SQL adapters  
**Storage**: Azure SQL (`app.Users`, `app.Roles`, `app.UserRoles`, `app.UserApplications`) with in-memory repositories for deterministic tests  
**Testing**: Vitest unit/contract/integration + CI gates (`lint`, `type-check`, `test`)  
**Target Platform**: Azure-hosted Next.js + local development runtime  
**Project Type**: Web application (frontend + API routes)  
**Performance Goals**: No material regression to dashboard load target (<3s under normal load); auth checks remain request-path lightweight  
**Constraints**: Exactly three roles; anonymous access prohibited on protected surfaces; 401/403 semantics must be consistent; no internal detail leakage; clean architecture boundaries preserved  
**Scale/Scope**: Five applications (Maestro, EYST, Prodigy, Vector, Navigate), all protected API routes and protected dashboard views

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Requirement (constitution.md) | Assessment | Status |
|------|-------------------------------|------------|--------|
| Principle V - Security & RBAC | Azure AD authentication, 3-role RBAC, API authz on all protected endpoints | Core feature intent directly implements this principle. | ✅ PASS |
| Principle VII - Clean Architecture | Keep business logic out of route/UI layers | Plan keeps route handlers thin and enforcement in auth/guard/service layers. | ✅ PASS |
| Principle IV - Deterministic Testing | Unit/contract/integration coverage with isolated runtime | Plan includes deterministic role/scope auth tests and endpoint behavior contracts. | ✅ PASS |
| Principle VI - Incremental Delivery | Independently deployable security slice | Scope is bounded to authn/authz enforcement without unrelated feature rewrites. | ✅ PASS |
| CI Quality Gates | Lint/type-check/tests pass for PR merges | Explicitly preserved as release gate for this feature. | ✅ PASS |

**Pre-Design Gate Result: ✅ PASS.**

## Project Structure

### Documentation (this feature)

```text
specs/011-authentication-authorization/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── authz-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
└── frontend/
    ├── app/
    │   ├── admin/
    │   │   └── users/
    │   │       └── components/
    │   └── api/
    │       ├── admin/users/**/route.ts
    │       ├── filters/**/route.ts
    │       ├── metrics/**/route.ts
    │       ├── pipeline/**/route.ts
    │       └── applications/**/route.ts
    ├── core/
    │   ├── application/services/
    │   │   └── AuthService.ts
    │   └── domain/
    │       ├── entities/
    │       │   ├── SessionEntity.ts
    │       │   ├── User.ts
    │       │   └── Role.ts
    │       └── repositories/
    │           ├── IUserRepository.ts
    │           ├── IRoleRepository.ts
    │           └── IUserApplicationRepository.ts
    ├── infrastructure/
    │   └── persistence/
    │       ├── database/
    │       ├── memory/
    │       └── runtime/
    └── lib/
        ├── auth/
        │   ├── session.ts
        │   ├── guards.ts
        │   ├── authorization.ts
        │   ├── admin-access.ts
        │   ├── dashboardScope.ts
        │   └── pipelineAuthorization.ts
        └── api/

tests/
├── contract/
├── integration/
└── unit/
```

**Structure Decision**: Reuse the existing Next.js clean-architecture structure and strengthen security behavior in current auth/session/guard modules. API routes remain transport adapters; role/scope decisions stay centralized in `lib/auth` and application services; database and in-memory adapters remain in infrastructure repositories.

## Phase 0: Research Summary

Resolved in `research.md`:

| Decision Area | Chosen Approach | Resolved |
|---------------|-----------------|----------|
| Authentication baseline | Enforce authenticated sessions for protected surfaces; align with Azure AD SSO target | YES |
| Authorization pattern | Centralized guard/assertion functions with role + scope checks | YES |
| Data scoping strategy | Enforce user-application scope server-side on all protected reads/writes | YES |
| Error semantics | Standardize 401 vs 403 responses with no internal detail leakage | YES |
| Route protection | Admin-only path protection for User Administration route and API | YES |
| Test strategy | Deterministic role/scope coverage in contract + integration suites | YES |

## Phase 1: Design Outputs

- `data-model.md` documents security-relevant domain entities and state transitions.
- `contracts/authz-contract.md` defines route/action and role/scope authorization behavior.
- `quickstart.md` defines implementation and verification runbook aligned with constitution gates.

## Post-Design Constitution Check

| Gate | Status | Notes |
|------|--------|-------|
| Principle V - Security & RBAC | ✅ PASS | Contracts/model enforce authn + role/scope semantics, and task coverage explicitly closes prior gaps with single-role enforcement (`T016`, `T017`) and identity-linked auditability (`T028`, `T029`) in `tasks.md`. |
| Principle VII - Clean Architecture | ✅ PASS | Design keeps route adapters thin and centralizes security logic in `lib/auth` and application services. |
| Principle IV - Deterministic Testing | ✅ PASS | Verification sequence requires deterministic role/scope suites, including explicit contract/integration coverage for single-role and auditability controls. |
| Principle VI - Incremental Delivery | ✅ PASS | Scope remains narrowly bounded to EPIC-BQM-005 behaviors and deploys independently. |

**Post-Design Gate Result: ✅ PASS.**

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
