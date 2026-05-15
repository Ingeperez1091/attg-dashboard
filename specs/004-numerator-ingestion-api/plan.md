# Implementation Plan: Numerator Data Ingestion API (EPIC-BQM-003)

**Branch**: `004-numerator-ingestion-api` | **Date**: 2026-04-30 | **Spec**: `specs/004-numerator-ingestion-api/spec.md`
**Input**: Feature specification from `specs/004-numerator-ingestion-api/spec.md`

## Summary

Deliver the MVP ingestion slice by implementing `POST /api/numerator` as a thin, secure API endpoint that validates request shape, enforces role/application authorization, and stages raw numerator payloads with audit metadata in `stage.EngagementUsageRaw` for asynchronous downstream processing. The design keeps ingestion concerns separate from denominator validation, filtering, duplicate detection, and metric calculation.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 24.x (Next.js application context), SQL (Azure SQL)
**Primary Dependencies**: Next.js App Router API routes, Zod request validation, `mssql` parameterized SQL bindings, existing session/auth abstraction, repository factory/runtime selection in `src/frontend/infrastructure/persistence/runtime`
**Storage**: Azure SQL Database staging table `stage.EngagementUsageRaw` (primary), optional deterministic in-memory repository for unit/contract tests
**Testing**: Vitest test suites with API contract tests under `tests/contract` and integration tests under `tests/integration`; deterministic test-mode runtime
**Target Platform**: Next.js web/API deployment for local development and Azure-hosted environments
**Project Type**: Web application with server-side API routes
**Performance Goals**: Ingestion acknowledgments should satisfy spec success criteria (95% of valid requests acknowledged within 5 seconds under normal operating conditions)
**Constraints**: API layer contains route adapter only (no business or persistence logic); authorization required before persistence; parameterized SQL only; sanitize external input; preserve raw payload and audit metadata; no downstream processing in request path; CI gates (lint/type-check/tests) must pass; CI and standard integration suites MUST run with `DEV_SESSION_USER_ID` unset, with any dev-session override tests explicitly isolated and labeled
**Scale/Scope**: One endpoint (`POST /api/numerator`), one application per request, five in-scope applications (Maestro, EYST, Prodigy, Vector, Navigate), MVP scope only

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Requirement (constitution.md) | Assessment | Status |
|------|-------------------------------|------------|--------|
| Principle I - Data Integrity First | Preserve raw inputs and auditability in staging | Plan requires storing original payload in `stage.EngagementUsageRaw` with submitter metadata. | PASS |
| Principle III - Validated Data Ingestion | Intake stores first; validation/filtering occur asynchronously | Plan explicitly limits request path to staging and defers denominator/duplicate/filter checks to downstream pipeline. | PASS |
| Principle IV - Test-First Development | Contract + integration coverage for API behavior | Plan defines contract tests for HTTP behavior and integration tests for staged persistence/audit metadata. | PASS |
| Principle V - Security & RBAC | 401/403 enforcement, role-based access, sanitization | Plan enforces authenticated/authorized requests only and rejects viewer/unauthorized submissions. | PASS |
| Principle VI - Incremental Delivery | Deliver independently testable MVP slice | Plan scope is ingestion-only and deployable independently of downstream processing. | PASS |
| Principle VII - Clean Architecture | Keep route thin, business logic in services, persistence in infrastructure | Plan uses route-service-repository layering with no persistence logic in route handlers. | PASS |
| CI Pipeline Gate | Baseline CI must protect trunk before feature source work | Existing repository CI gate is already established and remains a merge prerequisite. | PASS |
| IaC/CD Gates | No out-of-scope infra/CD activation changes | No infra or production CD changes introduced by this feature plan. | PASS |

**Pre-Design Gate Result: ALL PASS.**

### Post-Design Gate Review

- Principle I - PASS: Data model requires immutable staging payload + audit metadata.
- Principle III - PASS: Contracts and quickstart preserve async downstream boundaries.
- Principle IV - PASS: Quickstart includes contract/integration validation sequence.
- Principle V - PASS: Contract defines 401/403 and sanitized input handling.
- Principle VI - PASS: Deliverable remains an MVP ingestion slice only.
- Principle VII - PASS: Project structure keeps route/service/repository concerns separated.

No constitution violations require complexity justification.

## Project Structure

### Documentation (this feature)

```text
specs/004-numerator-ingestion-api/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── numerator-ingestion.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
src/
└── frontend/
    ├── app/
    │   └── api/
    │       └── numerator/
    │           └── route.ts
    ├── core/
    │   ├── domain/
    │   │   └── repositories/
    │   │       └── numeratorIngestionRepository.ts
    │   └── application/
    │       └── services/
    │           └── numeratorIngestionService.ts
    ├── infrastructure/
    │   └── persistence/
    │       ├── database/
    │       │   └── sqlNumeratorIngestionRepository.ts
    │       ├── memory/
    │       │   └── inMemoryNumeratorIngestionRepository.ts
    │       └── runtime/
    │           └── numeratorIngestionRepositoryFactory.ts
    └── lib/
        ├── auth/
        ├── db/
        └── validation/
            └── numeratorIngestionSchema.ts

database/
├── schema/
├── migrations/
└── seed/

tests/
├── contract/
│   └── numerator-ingestion/
├── integration/
│   └── numerator-ingestion/
└── unit/
```

**Structure Decision**: Use the existing Next.js web-application architecture under `src/frontend` with a dedicated `app/api/numerator/route.ts` transport adapter only. Place ingestion orchestration in `core/application/services`, repository contracts in `core/domain/repositories`, and concrete SQL/in-memory persistence in `infrastructure/persistence/*`. Keep request schema validation reusable in `lib/validation` and follow established test folder conventions under `tests/contract` and `tests/integration`.

## Phase 0: Research Summary

Resolved in `research.md`:

| Decision Area | Chosen Approach | Resolved |
|---------------|-----------------|----------|
| Endpoint shape | `POST /api/numerator` with one application per request | YES |
| Layering | Clean architecture separation: route adapter only, application service orchestration, domain repository contracts, infrastructure persistence implementations | YES |
| Authorization | `administrator` any app; `application_owner` assigned apps only; `viewer` denied | YES |
| Persistence | Parameterized SQL into `stage.EngagementUsageRaw` with audit metadata | YES |
| Test strategy | Contract tests + integration persistence/audit verification | YES |

## Phase 1: Design Outputs

- `data-model.md` defines request, staged record, access context, and acknowledgment entities with validation rules and state transitions.
- `contracts/numerator-ingestion.openapi.yaml` defines request/response schemas and error semantics for `POST /api/numerator`.
- `quickstart.md` defines implementation flow, verification commands, and manual API checks aligned to intake endpoint behavior.

## Post-Design Constitution Check

| Gate | Status | Notes |
|------|--------|-------|
| Principle I - Data Integrity First | PASS | Staging-first, raw payload retention, and upload metadata are explicit in data model and quickstart. |
| Principle III - Validated Data Ingestion | PASS | Intake staging is immediate; downstream validation is explicitly asynchronous and out of request scope. |
| Principle IV - Test-First Development | PASS | Contract and integration verification steps are defined before implementation. |
| Principle V - Security & RBAC | PASS | Contract and research decisions enforce 401/403 and role/application scope checks. |
| Principle VI - Incremental Delivery | PASS | Plan remains bounded to MVP intake endpoint and staging behavior. |
| Principle VII - Clean Architecture | PASS | Route remains transport-only and business/persistence concerns stay in application/domain/infrastructure layers. |

**Post-Design Gate Result: ALL PASS.**

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
