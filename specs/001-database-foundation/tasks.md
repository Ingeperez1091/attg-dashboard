# Tasks: Database Foundation - Schema Setup & Seed Data

**Input**: Design documents from `/specs/001-database-foundation/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included because the constitution requires test-first development and the plan explicitly requires deployment validation, seed idempotency verification, and external connectivity checks.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the repository locations and shared validation scaffolding used by all database foundation work.

- [x] T001 Create database foundation execution guide in database/migrations/README.md
- [x] T002 [P] Create shared SQL validation checklist in tests/contract/database-foundation/README.md
- [x] T003 [P] Create integration validation checklist for database foundation in tests/integration/database-foundation/README.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the shared schema bootstrap, audit conventions, and deployment validation assets that all user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Create schema bootstrap script for `app` and `stage` schemas in database/migrations/001_create_schemas.sql
- [x] T005 [P] Create shared audit defaults and update behavior script in database/migrations/002_create_audit_conventions.sql
- [x] T006 [P] Create database foundation validation script for schema presence and audit columns in database/views/external-access-validation.sql
- [x] T007 Create deployment ordering notes for schema, seed, and validation scripts in database/migrations/deployment-order.md

**Checkpoint**: Foundation ready; user story implementation can now begin.

---

## Phase 3: User Story 1 - Create Core Application & Role Schema (Priority: P1) 🎯 MVP

**Goal**: Create the local `app` schema tables that support applications, users, roles, and application assignments.

**Independent Test**: Run the schema contract checks and verify `Applications`, `Roles`, `Users`, `UserRoles`, and `UserApplications` exist with GUID primary keys, required constraints, and full audit columns.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T008 [P] [US1] Create contract test for core `app` schema objects in tests/contract/database-foundation/us1-core-schema.contract.sql
- [x] T009 [P] [US1] Create integration validation for audit behavior and key constraints in tests/integration/database-foundation/us1-core-schema.integration.sql

### Implementation for User Story 1

- [x] T010 [P] [US1] Create `Applications` table script in database/schema/app/Applications.sql
- [x] T011 [P] [US1] Create `Roles` table script in database/schema/app/Roles.sql
- [x] T012 [P] [US1] Create `Users` table script in database/schema/app/Users.sql
- [x] T013 [P] [US1] Create `UserRoles` table script with one-role-per-user enforcement in database/schema/app/UserRoles.sql
- [x] T014 [P] [US1] Create `UserApplications` table script with duplicate-assignment protection in database/schema/app/UserApplications.sql
- [x] T015 [US1] Create migration wrapper to execute all core `app` schema table scripts in database/migrations/003_create_app_schema_objects.sql
- [x] T016 [US1] Extend schema validation checks for core `app` tables and constraints in database/views/external-access-validation.sql

**Checkpoint**: User Story 1 is complete when the local `app` schema exists and can be validated independently.

---

## Phase 4: User Story 2 - Create Staging Schema for Raw Numerator Ingestion (Priority: P1)

**Goal**: Create the append-only staging table that preserves raw numerator payloads before any processing.

**Independent Test**: Insert representative JSON payloads and verify they are stored unchanged in `stage.EngagementUsageRaw` with the expected application reference and audit metadata.

### Tests for User Story 2 ⚠️

- [x] T017 [P] [US2] Create contract test for raw staging schema and column definitions in tests/contract/database-foundation/us2-staging-schema.contract.sql
- [x] T018 [P] [US2] Create integration validation for append-only staging inserts and query filtering in tests/integration/database-foundation/us2-staging-schema.integration.sql

### Implementation for User Story 2

- [x] T019 [US2] Create `EngagementUsageRaw` staging table script in database/schema/stage/EngagementUsageRaw.sql
- [x] T020 [US2] Create migration wrapper to deploy the staging table and indexes in database/migrations/004_create_stage_engagement_usage_raw.sql
- [x] T021 [US2] Extend schema validation checks for staging table structure and raw payload storage in database/views/external-access-validation.sql

**Checkpoint**: User Story 2 is complete when raw numerator payloads can be stored and queried independently of other stories.

---

## Phase 5: User Story 3 - Validate External Mercury Denominator Access (Priority: P1)

**Goal**: Validate that the system can connect to and query the Mercury-managed external denominator view `vw_USTaxBTS_FY26_MaxACD` without recreating it locally.

**Independent Test**: Execute the external access validation script using Mercury-provided credentials and confirm connection success, readable results, and required columns.

### Tests for User Story 3 ⚠️

- [x] T022 [P] [US3] Create contract test for required external denominator columns in tests/contract/database-foundation/us3-external-denominator.contract.sql
- [x] T023 [P] [US3] Create integration validation for Mercury database connectivity and readable view access in tests/integration/database-foundation/us3-external-denominator.integration.sql

### Implementation for User Story 3

- [x] T024 [US3] Implement external denominator connectivity validation query for `vw_USTaxBTS_FY26_MaxACD` in database/views/external-access-validation.sql
- [x] T025 [US3] Create deployment notes for Mercury credentials, connection prerequisites, and failure handling in database/views/external-access-validation.md
- [x] T026 [US3] Add quickstart instructions for external denominator validation in specs/001-database-foundation/quickstart.md

**Checkpoint**: User Story 3 is complete when Mercury access can be validated independently and failures produce actionable deployment feedback.

---

## Phase 6: User Story 4 - Seed Initial Applications, Roles, and Super-Admin User (Priority: P1)

**Goal**: Seed the local database with deterministic application metadata, role definitions, and the super-admin user with full application access.

**Independent Test**: Run seed scripts twice and verify five applications, three roles, one super-admin, one role assignment per user, and full application assignments without duplicates.

### Tests for User Story 4 ⚠️

- [x] T027 [P] [US4] Create contract test for deterministic seed data and stable business keys in tests/contract/database-foundation/us4-seed-data.contract.sql
- [x] T028 [P] [US4] Create integration validation for seed idempotency and super-admin scope in tests/integration/database-foundation/us4-seed-data.integration.sql

### Implementation for User Story 4

- [x] T029 [P] [US4] Create deterministic application seed script for the five supported applications in database/seed/seed-applications.sql
- [x] T030 [P] [US4] Create deterministic role seed script for `administrator`, `application_owner`, and `viewer` in database/seed/seed-roles.sql
- [x] T031 [P] [US4] Create deterministic super-admin seed and assignment script in database/seed/seed-superadmin.sql
- [x] T032 [US4] Create seed execution wrapper for ordered, repeatable seed deployment in database/migrations/005_run_seed_scripts.sql
- [x] T033 [US4] Extend validation checks for seed counts, one-role-per-user enforcement, and all-application admin assignment in database/views/external-access-validation.sql

**Checkpoint**: User Story 4 is complete when the seeded database can be rerun idempotently and validated independently.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Finalize documentation and end-to-end validation across all user stories.

- [x] T034 [P] Update feature quickstart with final deployment and validation flow in specs/001-database-foundation/quickstart.md
- [x] T035 [P] Update implementation plan references to final script names if needed in specs/001-database-foundation/plan.md
- [x] T036 Run full database foundation validation and capture execution notes in specs/001-database-foundation/research.md

---

## Phase 8: Deployment Automation

**Purpose**: Provide a repeatable PowerShell setup workflow and SQL project snapshot output.

- [x] T037 Create database setup automation script in scripts/database/setup-database.ps1
- [x] T038 Update migration runbook to use automated setup workflow in database/migrations/README.md
- [x] T039 Update specification and quickstart to include automation requirement and workflow in specs/001-database-foundation/spec.md and specs/001-database-foundation/quickstart.md
- [x] T040 Update implementation plan artifact list to include automation in specs/001-database-foundation/plan.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; starts immediately.
- **Foundational (Phase 2)**: Depends on Setup completion; blocks all story work.
- **User Stories (Phases 3-6)**: Depend on Foundational completion.
- **Polish (Phase 7)**: Depends on all target user stories being complete.

### User Story Dependencies

- **US1**: Starts after Phase 2; no dependency on other user stories.
- **US2**: Starts after Phase 2; independent of US1 except for shared schema bootstrap and audit conventions.
- **US3**: Starts after Phase 2; independent because it validates an external dependency rather than local schema creation.
- **US4**: Starts after Phase 2 and depends on local core schema from US1 being available for foreign-key-backed seed execution.

### Within Each User Story

- Tests must be written first and fail before implementation.
- Table or validation definitions precede migration wrappers.
- Validation script updates follow the implementation they verify.
- Each story is independently testable at its checkpoint.

---

## Parallel Opportunities

- `T002` and `T003` can run in parallel.
- `T005` and `T006` can run in parallel after `T004`.
- In **US1**, `T008` and `T009` can run in parallel, and `T010` through `T014` can run in parallel.
- In **US2**, `T017` and `T018` can run in parallel.
- In **US3**, `T022` and `T023` can run in parallel.
- In **US4**, `T027` and `T028` can run in parallel, and `T029` through `T031` can run in parallel.

---

## Parallel Example: User Story 1

```text
T008 [US1] Contract test for core app schema
T009 [US1] Integration validation for audit behavior and key constraints

T010 [US1] Applications table script
T011 [US1] Roles table script
T012 [US1] Users table script
T013 [US1] UserRoles table script
T014 [US1] UserApplications table script
```

## Parallel Example: User Story 4

```text
T027 [US4] Contract test for deterministic seed data
T028 [US4] Integration validation for seed idempotency

T029 [US4] Application seed script
T030 [US4] Role seed script
T031 [US4] Super-admin seed script
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational prerequisites.
3. Complete Phase 3: User Story 1.
4. Complete Phase 4: User Story 2.
5. Complete Phase 6: User Story 4.
6. Validate the core local database foundation end to end.
7. Add Phase 5 external Mercury validation if Mercury credentials are available; otherwise keep it as the last unblocker for full downstream readiness.

### Incremental Delivery

1. Deliver local schema foundation for users, roles, applications, and assignments.
2. Add raw staging support for numerator ingestion.
3. Add deterministic seed data for administrative bootstrapping.
4. Add external Mercury access validation to confirm denominator readiness.

### Suggested MVP Scope

The smallest valuable MVP is **User Story 1**, because it establishes the core local schema that all subsequent work depends on. For a usable database foundation increment, complete **US1 + US2 + US4**. Add **US3** as soon as Mercury connectivity details are available.

---

## Notes

- All tasks follow the required checklist format.
- Story tasks include exact file paths.
- External Mercury work is limited to validation and documentation, not local view creation.
- The constitution requirement for test-first development is reflected directly in each story phase.
