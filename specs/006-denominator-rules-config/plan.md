# Implementation Plan: EPIC-008 Denominator Rules Configuration

**Branch**: `006-denominator-rules-config` | **Date**: 2026-05-05 | **Spec**: `specs/006-denominator-rules-config/spec.md`  
**Input**: Feature specification from `specs/006-denominator-rules-config/spec.md`

## Summary

Deliver denominator rule management as a configuration-driven feature with:

- Shared denominator model metadata (`DenominatorModels`) for all applications
- Per-application denominator rules (`DenominatorFilterRules`)
- Per-application adoption settings (`AdoptionSettings`)
- Read-only preview endpoint that returns current/projected impact without persistence
- RBAC enforcement (`administrator`, `application_owner`, `viewer`) and scoped access by assigned applications
- Audit logging through `app.RuleChangeAudit` with `ChangeScope` discriminator

Implementation follows existing clean architecture and repository/factory/runtime selection patterns already used for numerator features.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 24.x, T-SQL (Azure SQL compatible)  
**Primary Dependencies**: Next.js App Router API routes, React, Zod, `mssql`, existing auth/session abstraction, repository runtime wiring in `src/frontend/infrastructure/persistence/runtime/repositories.ts`  
**Storage**: Azure SQL Database (`app` and `stage` schemas), Mercury local denominator snapshot as architectural source for preview calculations  
**Testing**: Vitest contract and integration suites under `tests/contract` and `tests/integration` with deterministic in-memory repository mode for CI  
**Target Platform**: Next.js full-stack web app (local + Azure-hosted environments)  
**Project Type**: Web application with server-rendered UI plus API routes  
**Performance Goals**: UI and API interactions within existing dashboard targets (page usability within 3s; preview and config operations responsive under normal load)  
**Constraints**:

- Route handlers remain thin; business logic in `core/application/services`
- Domain contracts in `core/domain`; persistence in `infrastructure/persistence`
- SQL access uses parameterized queries only
- Preview endpoint is strictly non-persistent
- Authorization checks are mandatory before any data access/mutation
- CI gates (lint/type-check/tests) must pass before merge

**Scale/Scope**:

- Five applications in scope (Maestro, EYST, Prodigy, Vector, Navigate)
- ~17 denominator model fields, per-app rule sets, per-app adoption settings
- API surface: denominator model + rules + preview + adoption settings endpoints

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Gate

| Gate | Requirement | Assessment | Status |
|------|-------------|------------|--------|
| Principle I — Data Integrity First | Traceable, auditable metric configuration changes with audit columns | Data model and contracts include audit fields; rule/adoption changes are logged in `RuleChangeAudit` with before/after snapshots | ✅ |
| Principle II — Configuration-Driven Business Rules | Rules configurable by users, not hardcoded | Denominator rules/adoption settings are persisted configuration entities with API + UI flows | ✅ |
| Principle III — Validated Data Ingestion | Denominator/numerator logic must validate against defined rules | Plan enforces typed operator/value validation and scoped repository checks before persistence | ✅ |
| Principle IV — Test-First & Deterministic Isolation | Contract/integration tests with deterministic in-memory state | Plan includes contract + integration suites under existing deterministic test model | ✅ |
| Principle V — Security & RBAC | Auth + role checks on all API operations | Contract specifies 401/403; application/service layer performs scoped authorization | ✅ |
| Principle VI — Incremental Delivery | Independently deployable slice | Feature is deployable independently within filter configuration area | ✅ |
| Principle VII — Clean Architecture & Maintainability | Boundaries, low coupling, no duplicated contracts | Plan uses existing service/repository/factory patterns and single canonical contracts | ✅ |

**Pre-Design Result**: ✅ PASS (no violations)

### Post-Design Gate

Design artifacts (`research.md`, `data-model.md`, `quickstart.md`, `contracts/denominator-rules-config.openapi.yaml`) satisfy the same gates. No complexity exception required.

**Post-Design Result**: ✅ PASS

## Project Structure

### Documentation (this feature)

```text
specs/006-denominator-rules-config/
├── plan.md
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── denominator-rules-config.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
src/frontend/
├── app/
│   ├── filters/denominator/page.tsx
│   ├── components/filters/
│   │   ├── DenominatorRuleList.tsx
│   │   ├── DenominatorRuleEditor.tsx
│   │   ├── DenominatorPreview.tsx
│   │   └── AdoptionSettingsPanel.tsx
│   └── api/
│       ├── denomindator-model/route.ts
│       └── filters/denominator/[appId]/
│           ├── route.ts
│           ├── preview/route.ts
│           └── settings/route.ts
├── core/
│   ├── domain/
│   │   ├── entities/
│   │   ├── repositories/
│   │   │   ├── IDenominatorModelRepository.ts
│   │   │   ├── IDenominatorFilterRepository.ts
│   │   │   └── IAdoptionSettingsRepository.ts
│   │   └── value-objects/
│   └── application/services/
│       └── DenominatorFilterService.ts
├── infrastructure/
│   ├── validation/denominatorFilterSchemas.ts
│   ├── factories/RepositoryFactory.ts
│   └── persistence/
│       ├── database/
│       │   ├── DenominatorModelDbRepository.ts
│       │   ├── DenominatorFilterDbRepository.ts
│       │   ├── AdoptionSettingsDbRepository.ts
│       │   └── queries/
│       │       ├── denominator-model-queries.ts
│       │       ├── denominator-filter-queries.ts
│       │       └── adoption-settings-queries.ts
│       ├── memory/
│       │   ├── DenominatorModelMemoryRepository.ts
│       │   ├── DenominatorFilterMemoryRepository.ts
│       │   └── AdoptionSettingsMemoryRepository.ts
│       └── runtime/repositories.ts
└── lib/
    ├── auth/
    ├── db/
    └── validation/

database/
├── migrations/
│   ├── 010_create_denominator_models.sql
│   ├── 011_create_denominator_filter_rules.sql
│   ├── 012_create_adoption_settings.sql
│   ├── 013_alter_rule_change_audit_add_scope.sql
│   └── 014_seed_denominator_models_and_adoption_settings.sql
├── schema/app/
│   ├── DenominatorModels.sql
│   ├── DenominatorFilterRules.sql
│   └── AdoptionSettings.sql
└── seed/
    └── seed-denominator-models-and-adoption-settings.sql

tests/
├── contract/filters/denominator-filter-config/
└── integration/filters/denominator-filter-config/
```

**Structure Decision**:

Reuse the existing architecture boundaries and runtime repository selection approach already in place:

- API routes perform request parsing, auth checks, and response mapping only
- `DenominatorFilterService` orchestrates business validation and workflows
- Repository interfaces stay in `core/domain/repositories`
- Database/memory implementations stay in `infrastructure/persistence/*`
- Runtime repository resolution remains centralized via factory/runtime modules

## Phase 0: Research Summary

Resolved decisions from `research.md`:

1. Shared denominator model (no `ApplicationId`) with per-app rules and adoption settings
2. Canonical operator set reused from numerator (`EQUALS`, `NOT_EQUALS`, `IN_LIST`, etc.) with type-aware service validation
3. Read-only preview architecture (`POST /api/filters/denominator/{appId}/preview`) with dynamic, parameterized SQL based on model metadata
4. Audit scope discriminator via `RuleChangeAudit.ChangeScope` (`Numerator`, `Denominator`, `Adoption`)
5. Repository integration through existing `RepositoryBundle` + `RepositoryFactory.create()` pattern
6. Migration sequencing from `009` to `010`–`014`
7. Deterministic in-memory denominator seed strategy for testing

No unresolved clarification markers remain.

## Phase 1: Design Outputs

### Data Model (`data-model.md`)

Defined entities and constraints:

- `DenominatorModels` (shared model metadata)
- `DenominatorFilterRules` (per-app rules with canonical operators)
- `AdoptionSettings` (per-app settings, including `NumeratorSource: API | Manual`)
- `RuleChangeAudit` extension semantics via `ChangeScope`
- `DenominatorImpactPreview` as transient response model

Validation and relationship rules include:

- Operator-by-field-type restrictions (`text`, `numeric`, `date`)
- Active-row uniqueness constraints for duplicate rules and rule ordering
- Revenue metric constrained to active numeric denominator fields
- RBAC scoping requirement on reads/writes

### Contracts (`contracts/denominator-rules-config.openapi.yaml`)

Defined endpoints:

- `GET /api/denomindator-model`
- `GET/PUT /api/filters/denominator/{appId}`
- `POST /api/filters/denominator/{appId}/preview`
- `GET/PUT /api/filters/denominator/{appId}/settings`

Includes:

- Request/response schemas
- Error models (`401`, `403`, `404`, `400`, `500`, `409` where applicable)
- Canonical operator enum and field type enum (`text`, `numeric`, `date`)
- Adoption settings schema with `adoptionLevel` enum `[Engagement, Client]` and `numeratorSource` enum `[API, Manual]`

### Quickstart (`quickstart.md`)

Captures implementation flow, target file paths, test strategy, local validation commands, and example API calls consistent with this plan.

## Implementation Strategy

1. **Database First**

- Add migrations `010`–`014` and matching schema/seed scripts
- Ensure migration order and rollback compatibility

2. **Domain + Repositories**

- Add domain repository interfaces and entities/value types
- Implement SQL and in-memory repositories for denominator model, rules, settings
- Wire repositories through existing runtime/factory patterns

3. **Application Service**

- Implement `DenominatorFilterService` with:
  - rule retrieval
  - transactional replacement
  - preview orchestration (non-persistent)
  - adoption settings read/update
  - operator/type/value validation

4. **API Adapters**

- Implement route handlers for model/rules/preview/settings using existing auth/session patterns
- Keep handlers thin and delegate workflows to service layer

5. **UI Layer**

- Build denominator configuration page and supporting components using Motif patterns
- Enforce role behavior (edit/read-only) and preview-before-save flow

6. **Testing**

- Add contract tests for endpoint schemas/status codes/error responses
- Add integration tests for update/preview/audit/settings flows and authorization boundaries

## Test & Validation Plan

Run from repository root:

```powershell
npm run lint
npx tsc --noEmit
npm test -- --passWithNoTests
```

Targeted denominator suites:

```powershell
npx vitest run tests/contract/filters/denominator-filter-config tests/integration/filters/denominator-filter-config
```

Acceptance validation includes:

- RBAC enforcement (admin/owner/viewer)
- Atomic rule replacement and preserved state on failure
- Non-persistent preview behavior
- Adoption settings retrieval/update behavior
- Audit records written with correct scope and snapshots

## Risks & Mitigations

- **Risk**: Drift between denominator and numerator operator semantics  
  **Mitigation**: Reuse canonical labels and shared validation patterns from numerator implementation.

- **Risk**: Preview query complexity and SQL injection risk  
  **Mitigation**: Column names sourced only from trusted model metadata; values parameterized.

- **Risk**: Authorization leakage across applications  
  **Mitigation**: Mandatory app-scope checks at service/repository boundaries; contract/integration coverage for 401/403 paths.

- **Risk**: Behavior mismatch between in-memory and SQL implementations  
  **Mitigation**: Shared contract tests executed across deterministic test mode; parity checks for rule/order/audit semantics.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

## Implementation Status

| Phase | Scope | Status |
|-------|-------|--------|
| Phase 2 | Database foundation (migrations 010–014, schema, seed) | ✅ Complete |
| Phase 3 (US1) | View denominator model + rules | ✅ Complete |
| Phase 4 (US2) | Edit denominator rules with validation | ✅ Complete |
| Phase 5 (US3) | Preview impact (non-persistent) | ✅ Complete |
| Phase 6 (US4) | Adoption settings read/update | ✅ Complete |
| Phase 7 (US5) | Audit trail with `ChangeScope` discriminator | ✅ Complete |
| Phase 8 (US6) | Field/operator governance + non-filterable enforcement | ✅ Complete |
| Phase 9 | Polish, docs, cross-cutting validation | ✅ Complete |

**Test coverage**: 17 test files, 77 tests — all passing. Lint and TypeScript type-check clean.

