# Implementation Plan: Epic 004 — Numerator Filter Configuration

**Branch**: `005-numerator-filter-config` | **Date**: 2026-04-15   | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/005-numerator-filter-config/spec.md`

## Summary

**Primary Requirement**: Enable application owners to manage numerator filter rules via a metadata-driven configuration interface, where filter fields are dynamically sourced from application model definitions and enforced with role-based access control and audit logging.

**Technical Approach**: 
- Implement typed API endpoints (`GET/PUT /api/filters/numerator/:appId`) with Zod validation and authorization middleware
- Implement numerator model retrieval in the existing applications namespace (`GET /api/applications/:appId/numeratormodel`)
- Extend Azure SQL schema with `app.ApplicationModelFields` and `app.NumeratorFilterRules` linking (referential integrity)
- Build UI filter editor using Motif Web Components with type-aware operator selection
- Provide seed scripts to populate application model definitions for all five in-scope applications
- Implement audit logging on all rule changes via existing audit conventions (CreateDate, CreatedBy, UpdateDate, UpdatedBy)
- Enforce per-application scoping in retrieval and update operations with role/assignment boundary checks

**Grounding**: Feature aligns with Constitution Principle II (Configuration-Driven Business Rules) and Assumptions A9, A15, A16, A17 (metadata-driven models, filter rule FK links, payload template stability).

**Scope Note**:
- Pre-apply impact preview is explicitly deferred to a future design and is out of scope for this implementation plan.

## Technical Context

**Language/Version**: TypeScript 5.6 / Node.js 24.x  
**Primary Dependencies**: Next.js 15.1.7, React 18, Zod 3.23.8, mssql 12.5.0, Motif Web Components  
**Storage**: Azure SQL Database (ATTG_Usage), schemas `app` (core), `stage` (staging)  
**Testing**: Vitest 2.1.3 with V8 coverage (80% threshold); contract + integration test suites  
**Target Platform**: Web application (Next.js SPA with Server-Side Rendering)
**Project Type**: Next.js full-stack web application  
**Performance Goals**: Retrieval/update operations complete in ≤3 seconds (p95); UI renders within 3s  
**Constraints**: RBAC enforcement (administrator, application_owner, viewer); 100% unauthorized rejection; audit logging on all mutations; no cross-app field display  
**Scale/Scope**: Five applications (fixed for MVP); ~20–30 filterable fields across all apps; rule sets <<1000 rules per application

## Constitution Check

**Status**: ✅ PASS (no violations)

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Data Integrity First | ✅ PASS | Audit columns (CreateDate, CreatedBy, UpdateDate, UpdatedBy) on NumeratorFilterRules; all rule changes logged with actor, previous value, new value, timestamp; invalid submissions rejected and prior rule set preserved |
| II. Configuration-Driven Business Rules | ✅ PASS | Core purpose of this epic — numerator filters are fully configurable per application via model metadata; no hardcoded rules; application owners set rules via UI without engineering intervention |
| III. Validated Data Ingestion | ✅ PASS | Filter rules validated before storage; rules reference model-defined fields via FK link only (referential integrity enforced at DB layer); invalid references rejected with clear feedback |
| IV. Test-First Development | ✅ PASS | Contract tests validate request/response schemas and authorization boundaries; integration tests cover end-to-end filter retrieval, creation, editing, validation with deterministic in-memory repository isolation |

**No Complexity Justifications Required**: This feature aligns fully with existing architecture and does not introduce new patterns, dependencies, or violations.

## Project Structure

### Documentation (this feature)

```text
specs/005-numerator-filter-config/
├── plan.md              # This file (planning workflow output)
├── research.md          # Phase 0 research findings
├── data-model.md        # Phase 1 data model design
├── quickstart.md        # Phase 1 quick-start guide
├── spec.md              # Feature specification (4 user stories, 20 FRs, 8 SCs)
├── tasks.md             # Phase 2 output (task breakdown)
├── checklists/
│   └── requirements.md  # Quality validation checklist
└── contracts/           # Phase 1 API contracts
    ├── GET-numerator-filters.contract.md
    ├── PUT-numerator-filters.contract.md
    └── GET-application-models.contract.md  # documents GET /api/applications/:appId/numeratormodel
```

### Source Code (implementation locations)

```text
src/frontend/
├── app/api/
│   ├── applications/
│   │   ├── route.ts                 # existing list endpoint
│   │   └── [appId]/
│   │       └── numeratormodel/
│   │           └── route.ts         # GET /api/applications/:appId/numeratormodel
│   └── filters/
│       └── numerator/
│           └── [appId]/
│               ├── route.ts         # GET/PUT /api/filters/numerator/:appId
│               └── [...slug]/route.ts (future: detailed endpoints)
├── core/
│   ├── application/
│   │   ├── services/
│   │   │   ├── NumeratorFilterService.ts   # getFiltersByApplicationId, getModelByApplicationId, updateFilters
│   │   │   └── [other existing services: UserService, RoleService, ApplicationService, AuthService, numeratorIngestionService]
│   │   └── dto/
│   │       ├── NumeratorFilterDTO.ts
│   │       ├── ApplicationNumeratorModelDTO.ts
│   │       └── FilterRuleDTO.ts
│   ├── domain/
│   │   ├── repositories/
│   │   │   └── INumeratorFilterRepository.ts
│   │   ├── errors/
│   │   │   └── FilterValidationError.ts
│   │   └── valueobjects/
│   │       ├── FilterRule.ts
│   │       └── FieldOperator.ts
├── infrastructure/
│   ├── persistence/
│   │   ├── mssql/
│   │   │   └── queries/
│   │   │       └── NumeratorFilters.ts
│   │   ├── repositories/
│   │   │   ├── NumeratorFilterInMemoryRepository.ts
│   │   │   └── NumeratorFilterSqlRepository.ts
│   │   └── runtime/
│   │       └── index.ts (factory for repo selection)
│   ├── middleware/
│   │   └── filterAuthorizationMiddleware.ts
│   └── validation/
│       └── filterRuleSchemas.ts (Zod schemas)
└── lib/
    └── db/
        └── seed/
            └── seed-application-model-fields.sql (Phase 0: seed models)
database/
├── migrations/
│   ├── 001_create_schemas.sql                      # existing
│   ├── 002_create_audit_conventions.sql            # existing
│   ├── 003_create_app_schema_objects.sql           # existing
│   ├── 004_create_stage_engagement_usage_raw.sql   # existing
│   ├── 005_run_seed_scripts.sql                    # existing (currently empty)
│   ├── 006_create_application_model_fields.sql     # NEW — ApplicationModelFields table
│   ├── 007_create_numerator_filter_rules.sql       # NEW — NumeratorFilterRules table (FK → ApplicationModelFields)
│   ├── 008_create_rule_change_audit.sql            # NEW — RuleChangeAudit table
│   ├── 009_seed_application_model_fields.sql       # NEW — seed field definitions for 5 apps
│   └── README.md                                   # existing (update)
├── schema/app/
│   ├── ApplicationModelFields.sql                  # NEW — table DDL
│   ├── NumeratorFilterRules.sql                    # NEW — table DDL
│   └── RuleChangeAudit.sql                         # NEW — table DDL
├── seed/
│   └── seed-application-model-fields.sql           # NEW — MERGE seed for 5 app models
├── rollback/
│   ├── rollback_009_seed_application_model_fields.sql # NEW — DELETE seeded model data
│   ├── rollback_008_create_rule_change_audit.sql   # NEW — DROP TABLE
│   ├── rollback_007_create_numerator_filter_rules.sql # NEW — DROP TABLE
│   └── rollback_006_create_application_model_fields.sql # NEW — DROP TABLE

scripts/
├── database/                       # Database automation and migration runners
│   ├── run-migrations.ps1                          # NEW — sequential migration runner with rollback support
    ├── run-rollback.ps1                            # NEW — reverse-order rollback runner
│   ├── run-mercury-validation.ps1
│   └── setup-database.ps1
└── [other CI/scripting tasks]
```

### Test Suite (contract + integration)

```text
tests/
├── contract/
│   └── filters/
│       └── numerator-filter-config/
│       ├── api-filter-rules-get.contract.ts        # NEW
│       ├── api-filter-rules-put.contract.ts        # NEW
│       ├── api-filter-rules-authz.contract.ts      # NEW
│       ├── api-application-model.contract.ts       # NEW
│       └── db-schema.contract.sql                  # NEW — validate tables, FKs, constraints
├── integration/
│   └── filters/
│       └── numerator-filter-config/
│       ├── fixtures.ts                             # NEW
│       ├── filter-crud.integration.ts              # NEW
│       ├── filter-authz.integration.ts             # NEW
│       ├── filter-audit.integration.ts             # NEW
│       └── application-model.integration.ts        # NEW
```

**Structure Decision**: Extend existing clean architecture (app/core/domain/application/infrastructure/lib) to include filter module under `core/application/services`, `core/domain`, and `infrastructure/persistence/mssql/queries`. Business logic is encapsulated in `NumeratorFilterService` following the established service pattern (consistent with `UserService`, `RoleService`, `ApplicationService`). API routes instantiate the service directly and delegate orchestration to it. This avoids a redundant UseCase layer and maintains consistency with the rest of the codebase. Tests use Vitest with in-memory repository for deterministic isolation and SQL repository for integration validation. **Infrastructure Refactoring**: Move `database/ps_scripts/` → `scripts/database/` to centralize all project scripting under the `scripts/` directory, improving organization and CI/CD integration.

## Phase 0: Research & Clarification Resolution

**Status**: ✅ COMPLETE (no NEEDS CLARIFICATION markers in spec)

**Key Findings**:
1. **Metadata-Driven Field Selection** (Assumption A15): Application model fields are seeded in `app.ApplicationModelFields` table. Filter configuration UI reads active fields and disables options where `IsFilterable = 0`.
2. **referential Integrity** (Assumption A16): `NumeratorFilterRules` reference `ApplicationModelFields` via FK, ensuring filter rules can only reference valid model fields.
3. **Type-Aware Operators** (Spec FR-016): Operator dropdown adapts to field data type (text, numeric, boolean, date), per spec requirements.
4. **AND-Combined Rules** (Assumption A9): Multiple rules for one application are AND-combined; no OR/grouping needed for MVP.
5. **Per-Application Isolation** (Spec FR-014): Rules are stored separately per application; no cross-app leakage.
6. **Authorization Model**: Three roles (administrator, application_owner, viewer) determine edit rights; audit logging on all mutations.
7. **Performance Target** (Spec SC-004): 95% of operations complete in ≤3 seconds; retrieval and update endpoints must be indexed and optimized.

**Database Design Notes**:
- Extend `app.ApplicationModelFields` with field-level metadata (FieldName, FieldType, SourcePath, IsFilterable, IsMetricDimension, DisplayOrder)
- Create `app.NumeratorFilterRules` table with ApplicationId FK, ApplicationModelFieldId FK, Operator, Value, and ordering
- Use existing audit columns (CreateDate, CreatedBy, UpdateDate, UpdatedBy)
- Ensure indexes on (ApplicationId, ApplicationModelFieldId) for fast retrieval and (ApplicationId) for filtering

## Phase 1: Design & Contracts

### 1.1 Data Model (data-model.md)

**Entities**:
1. **Application** (existing): ApplicationId, Name, ServiceLine, SubServiceLine, IsActive
2. **ApplicationModelField** (new): ApplicationModelFieldId, ApplicationId, FieldName, FieldType (text/numeric/boolean/date), SourcePath (JSON path), IsFilterable, IsMetricDimension, DisplayOrder
3. **NumeratorFilterRule** (new): RuleId, ApplicationId, ApplicationModelFieldId, Operator (EQUALS/NOT_EQUALS/CONTAINS/GREATER_THAN/etc.), Value, RuleOrder, CreateDate, CreatedBy, UpdateDate, UpdatedBy
4. **RuleChangeAudit** (new): AuditId, ApplicationId, ActorUserId, PreviousRulesJson, NewRulesJson, ChangedAt

**Relationships**:
- Application → ApplicationModelField (1:M, ApplicationId FK)
- Application → NumeratorFilterRule (1:M, ApplicationId FK)
- ApplicationModelField → NumeratorFilterRule (1:M, ApplicationModelFieldId FK — referential integrity enforced)
- User → NumeratorFilterRule (CreatedBy/UpdatedBy)
- Application → RuleChangeAudit (1:M, ApplicationId FK)

**Validation Rules**:
- ApplicationModelFieldId must exist and IsFilterable = 1 for the target application
- Operator must be valid for the field's FieldType
- Value format depends on field type (e.g., numeric validation for numeric fields)
- Rule order must be positive integer; enforced at insertion/update

**Audit Usage Rules**:
- `RuleChangeAudit` is the source for historical snapshots and change history.
- `NumeratorFilterRule.CreatedBy` and `NumeratorFilterRule.UpdatedBy` are returned for current-rule audit display in the UI.

**State Transitions**:
- Rules can be created, modified, or soft-deleted
- Deletion uses soft-delete semantics: mark prior active rows as `IsActive = 0`; do not physically delete rule rows

### 1.2 API Contracts (contracts/)

Three contract files will define request/response schemas:

**1. GET /api/filters/numerator/:appId**
- **Purpose**: Retrieve current numerator filter rules for an application
- **Request**: Path param `appId` (UUID), Authorization header
- **Response**: Object payload with application metadata and ordered rules (`applicationId`, `applicationName`, `rules`, `lastUpdatedAt`, `lastUpdatedBy`)
- **Errors**: 401 (unauthorized user), 403 (not assigned to app), 404 (app not found), 500 (internal error)
- **Zod Schema**: Request validated by authorization middleware; response validated by contract test

**2. PUT /api/filters/numerator/:appId**
- **Purpose**: Update numerator filter rules for an application
- **Request**: Path param `appId` (UUID), body `{ rules: [{ applicationModelFieldId, operator, value }] }`
- **Validation**: All rules reference valid, filterable fields for the application; all operators are type-appropriate
- **Response**: Updated active rule set (rows with `IsActive = 1`) with same structure as GET response
- **Errors**: 400 (validation error with clear feedback, including non-filterable field submissions), 401, 403, 404, 409 (concurrent update conflict), 500
- **Zod Schema**: Request body validated with Zod; validation errors returned structured

**3. GET /api/applications/:appId/numeratormodel**
- **Purpose**: Retrieve numerator model field definitions for a specific application
- **Request**: Path param `appId`
- **Response**: Object payload containing `applicationId`, `applicationName`, and `fields` (ordered active model fields with FieldName, FieldType, IsFilterable, IsMetricDimension, DisplayOrder; UI disables `isFilterable=false` options)
- **Errors**: 401, 403, 404, 500
- **Zod Schema**: Same validation as above

### 1.3 Quick-Start Guide (quickstart.md)

**Running Contract Tests**:
```bash
npm run test -- filters
```
Validates request/response schemas, status codes, error payloads.

**Running Integration Tests**:
```bash
npm run test -- filters --run --reporter=verbose
```
Tests end-to-end flow: create rules, update, retrieve, validate authorization.

**Local Development**:
1. Seed application model fields: `npm run db:seed` (runs seed-application-model-fields.sql)
2. Start dev server: `npm run dev`
3. Navigate to filter configuration tab in dashboard
4. Create/edit rules for assigned application (USE_INMEMORY_REPOSITORY=false for SQL mode)

**API Testing (cURL)**:
```bash
# Get rules for an application UUID
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/filters/numerator/10000000-0000-0000-0000-000000000001

# Update rules for an application UUID
curl -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
        -d '{"rules":[{"applicationModelFieldId":"30000000-0000-0000-0000-000000000001","operator":"EQUALS","value":"Active"}]}' \
    http://localhost:3000/api/filters/numerator/10000000-0000-0000-0000-000000000001
```

## Phase 2: Implementation Task Breakdown (summary)

**Task Categories**:

### T0: Infrastructure & Setup
- [X] T0.1: Refactor directory structure — move `database/ps_scripts/` → `scripts/database/`
- [ ] T0.2: Update CI/CD scripts (apply-to-ci.ps1, etc.) to reference new script paths
- [ ] T0.3: Verify all PowerShell script invocations use new paths in workflows and documentation
- [ ] T0.4: Add migration runner design in scripts/database/migrate.ps1 with rollback command support and rollback folder convention

### T1: Database & Schema Setup
- [ ] T1.1: Extend ApplicationModelFields table with field-level metadata columns
- [ ] T1.2: Create NumeratorFilterRules table with FK constraints and indexes
- [ ] T1.3: Write seed-application-model-fields.sql for all 5 applications with filterable field definitions
- [ ] T1.4: Create database migration files (apply-to-ci.ps1 integration)

### T2: Repository & Persistence Layer
- [ ] T2.1: Create INumeratorFilterRepository interface in core/domain (Get, Update operations)
- [ ] T2.2: Implement NumeratorFilterInMemoryRepository in infrastructure/persistence for contract/integration tests
- [ ] T2.3: Implement NumeratorFilterSqlRepository in infrastructure/persistence with mssql driver and query optimization
- [ ] T2.4: Create SQL query module (filters-queries.ts) with parameterized queries

### T3: API Endpoints & Validation
- [ ] T3.1: Create Zod schemas for filter request/response validation (filterRuleSchemas.ts)
- [ ] T3.2: Implement GET /api/filters/numerator/:appId endpoint with authorization check
- [ ] T3.3: Implement PUT /api/filters/numerator/:appId endpoint with validation and auditLogging
- [ ] T3.4: Implement GET /api/applications/:appId/numeratormodel endpoint for model field retrieval

### T4: Use Cases & Business Logic
- [ ] T4.1: Create GetNumeratorFiltersUseCase with authorization and scoping
- [ ] T4.2: Create UpdateNumeratorFiltersUseCase with validation, FK checks, audit logging
- [ ] T4.3: Create GetApplicationNumeratorModelUseCase returning all active per-app fields plus `isFilterable` flags for disabled UI behavior
- [ ] T4.4: Implement FilterRule value object with operator validation logic

### T5: Authorization & Audit
- [ ] T5.1: Create filterAuthorizationMiddleware checking role + assignment
- [ ] T5.2: Persist RuleChangeAudit records with actor, previous rules snapshot, new rules snapshot, and timestamp on accepted updates
- [ ] T5.3: Test unauthorized rejection (viewer, unassigned owner, out-of-scope app)

### T6: Front-End Filter Editor UI
- [ ] T6.1: Create NumeratorFilterEditor component using Motif Web Components
- [ ] T6.2: Implement field selector dropdown (populated from all active ApplicationModelFields, disabling `isFilterable=false` entries)
- [ ] T6.3: Implement operator dropdown (type-aware, adapted per field selection)
- [ ] T6.4: Implement value input with type-appropriate validation
- [ ] T6.5: Implement rule list display with edit/delete per-rule actions
- [ ] T6.6: Implement save/cancel with optimistic UI update and 400 validation feedback handling
- [ ] T6.7: Display current-rule `CreatedBy` / `UpdatedBy` metadata in rule audit UI elements

### T7: Contract & Integration Tests
- [ ] T7.1: Write contract tests for GET /api/filters/numerator/:appId (200, 401, 403, 404)
- [ ] T7.2: Write contract tests for PUT /api/filters/numerator/:appId (200, 400, 401, 403, 404), including `FIELD_NOT_FILTERABLE` rejection behavior
- [ ] T7.3: Write contract tests for GET /api/applications/:appId/numeratormodel
- [ ] T7.4: Write integration tests for full flow (create, retrieve, update, validate)
- [ ] T7.5: Write integration tests asserting RuleChangeAudit persistence and payload correctness
- [ ] T7.6: Write authorization tests (verify 100% unauthorized rejection)
- [ ] T7.7: Write performance tests (verify 95% under 3s)
- [ ] T7.8: Add repeatable performance validation workflow and acceptance evidence capture for SC-004

### T8: Documentation & Deployment
- [ ] T8.1: Update README.md with filter configuration feature overview
- [ ] T8.2: Document model field definitions per application (Navigate, EYST, Prodigy, Maestro, Vector)
- [ ] T8.3: Create runbook for seed script execution and troubleshooting
- [ ] T8.4: Update CI/CD pipeline to run database migrations on deploy

**Estimated Task Count**: ~33–38 tasks across all categories
**Dependency Order**: Infrastructure (T0) → DB setup (T1) → Persistence (T2) → Use Cases (T4) → API (T3) → Auth (T5) → UI (T6) → Tests (T7) → Docs (T8)

See `tasks.md` for full task breakdown with acceptance criteria and owner assignments (generated via `/speckit.tasks`).

---