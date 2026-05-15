# Implementation Plan: Database Foundation - Schema Setup & Seed Data

**Branch**: `001-database-foundation` | **Date**: 2026-04-14 | **Spec**: `specs/001-database-foundation/spec.md`
**Input**: Feature specification from `specs/001-database-foundation/spec.md`

## Summary

Establish the database foundation for the dashboard by creating core `app` schema tables, immutable `stage` ingestion storage, deterministic seed data, and external denominator access validation for the Mercury-managed view. The approach uses Azure SQL idempotent migration scripts, deterministic seed logic keyed by stable business identifiers, and test-first contract/integration validations before implementation scripts.

## Technical Context

**Language/Version**: T-SQL (Azure SQL Database, SQL Server 2022-compatible) with repository-aligned TypeScript/Next.js integration context  
**Primary Dependencies**: Azure SQL Database, Azure DevOps migration execution, external Mercury SQL view access, Azure AD identity metadata  
**Storage**: Azure SQL Database (`app` and `stage` schemas); Mercury-managed external SQL view (`vw_USTaxBTS_FY26_MaxACD`)  
**Testing**: SQL contract tests and SQL integration validation scripts under `tests/contract` and `tests/integration`  
**Target Platform**: Azure SQL Database + CI/CD execution from Azure DevOps  
**Project Type**: Web application data foundation (database-first slice)  
**Performance Goals**: Staging inserts complete without payload truncation; foundational queries/indexes support dashboard data access and filters  
**Constraints**: Preserve raw JSON payloads up to 1 MB; deterministic/idempotent deployments; exactly one role per user; immutable staging rows  
**Scale/Scope**: 5 seeded applications, 3 seeded roles, 1 super-admin bootstrap, external denominator validation, foundations for subsequent epics

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Research Gate Review

- Principle I - Data Integrity First: PASS. Plan preserves raw numerator payloads in `stage.EngagementUsageRaw`, enforces audit columns on mutable tables, and defines traceable deterministic seeds.
- Principle II - Configuration-Driven Business Rules: PASS. Foundation models applications/roles/assignments and does not hardcode denominator logic into local recreated views.
- Principle III - Validated Data Ingestion: PASS. Staging-first ingestion is explicit; downstream validation remains in later epics.
- Principle IV - Test-First Development: PASS. Contract and integration SQL validation are required before implementation scripts in tasks.
- Principle V - Security & RBAC: PASS. Exactly one role per user is enforced in schema design; super-admin bootstrap is required.
- Principle VI - Incremental Delivery: PASS. Feature is independently deployable as a database MVP slice.

### Post-Design Gate Review

- Principle I - Data Integrity First: PASS. Data model fixes unresolved ambiguity by standardizing `StageId` as `UNIQUEIDENTIFIER` and UTC audit behavior as database-populated for migration/seed correctness.
- Principle II - Configuration-Driven Business Rules: PASS. Contracts preserve external Mercury ownership and keep local data structures configuration-ready.
- Principle III - Validated Data Ingestion: PASS. Quickstart and contracts keep ingest flow as stage-first.
- Principle IV - Test-First Development: PASS. Contracts and quickstart define contract/integration verification order before deployment validation signoff.
- Principle V - Security & RBAC: PASS. Seed contract and data model enforce one-role-per-user and full super-admin application access.
- Principle VI - Incremental Delivery: PASS. Scope remains constrained to foundation assets required by future phases.

No constitution violations require complexity justification.

## Project Structure

### Documentation (this feature)

```text
specs/001-database-foundation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── schema-contract.md
│   ├── seed-contract.md
│   └── external-denominator-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
database/
├── migrations/
├── schema/
│   ├── dbo/
│   └── stage/
├── seed/
└── views/

src/
├── api/
├── frontend/
└── shared/

tests/
├── contract/
└── integration/
```

**Structure Decision**: Use the existing repository layout centered on `database/` for all foundation SQL assets and `tests/` for SQL validation scripts, while keeping compatibility with the `src/` application layers that consume these database objects.

## Phase 0 Research Output

- Resolved key decisions in `research.md` for key strategy, external denominator ownership, append-only staging, one-role-per-user enforcement, audit behavior, and deterministic seeding.
- Added explicit resolution for UTC audit timestamp conflict: database-side UTC defaults/triggers are the source of truth for migration/seed consistency.

## Phase 1 Design Output

- Data entities and relationships documented in `data-model.md`.
- Interface contracts documented under `contracts/` for local schema, seed data, and external denominator validation boundary.
- Execution and validation flow documented in `quickstart.md`.

## Implementation Artifacts

- Migrations: `database/migrations/001_create_schemas.sql` through `database/migrations/005_run_seed_scripts.sql`
- Automation: `scripts/database/setup-database.ps1`
- Core schema scripts: `database/schema/app/*.sql`
- Staging schema script: `database/schema/stage/EngagementUsageRaw.sql`
- Seed scripts: `database/seed/seed-applications.sql`, `database/seed/seed-roles.sql`, `database/seed/seed-superadmin.sql`
- Validation and runbook: `database/views/external-access-validation.sql`, `database/views/external-access-validation.md`
- SQL tests: `tests/contract/database-foundation/*.sql`, `tests/integration/database-foundation/*.sql`

## Complexity Tracking

No constitution gate violations identified.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
