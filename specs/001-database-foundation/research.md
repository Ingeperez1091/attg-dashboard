# Research: Database Foundation - Schema Setup & Seed Data

## Decision 1: Use GUID primary keys for local core entities

**Decision**: Use `UNIQUEIDENTIFIER` primary keys for local application tables such as `Applications`, `Roles`, `Users`, `UserRoles`, and `UserApplications`.

**Rationale**: The current spec was updated to expect GUID primary keys in acceptance validation. Using GUIDs also works cleanly with distributed creation patterns, Azure AD-linked user identities, and cross-environment seed consistency.

**Alternatives considered**:
- Integer identity keys: simpler for SQL authoring, but inconsistent with the current spec and less stable for cross-environment seeding.
- Mixed key strategy: rejected because it adds unnecessary inconsistency this early.

## Decision 2: Keep the Mercury denominator view external

**Decision**: Do not create `vw_USTaxBTS_FY26_MaxACD` in the local application database. Treat it as an external dependency owned by Mercury and validate connectivity and query access during deployment and integration checks.

**Rationale**: The updated spec explicitly states the view is provided by Mercury in an external database. Recreating it locally would conflict with the source-of-truth boundary and create drift risk.

**Alternatives considered**:
- Recreate the view locally: rejected because it violates ownership boundaries and can diverge from Mercury-managed logic.
- Copy denominator data into a local table in this feature: rejected because it expands scope beyond database foundation.

## Decision 3: Preserve raw numerator payloads in append-only staging

**Decision**: Model `stage.EngagementUsageRaw` as an append-only staging table with `PayloadJson`, `ApplicationId`, `CreateDate`, and `CreatedBy`, plus optional processing metadata if needed later.

**Rationale**: This directly satisfies the constitution's data integrity and validated ingestion principles. The first persistent representation of numerator data must be raw and auditable.

**Alternatives considered**:
- Store parsed numerator rows only: rejected because raw payload traceability would be lost.
- Validate before storage: rejected because failed payloads still need auditability.

## Decision 4: Enforce one role per user in the schema

**Decision**: Design the role assignment model so each user has exactly one active role at a time, matching the constitution.

**Rationale**: The constitution is explicit: exactly one of `administrator`, `application_owner`, or `viewer` is allowed per user at any point. The schema must enforce that instead of leaving it to application logic alone.

**Alternatives considered**:
- Many-to-many user-to-role model without restriction: rejected because it conflicts with the constitution.
- Store role only on the Users table: possible, but a dedicated assignment table retains clearer auditability and future extensibility.

## Decision 5: Use database-managed audit defaults and update behavior

**Decision**: Implement `CreateDate`, `CreatedBy`, `UpdateDate`, and `UpdatedBy` on all mutable local tables with UTC defaults and update-safe behavior handled by the database deployment pattern.

**Rationale**: This keeps audit behavior consistent across scripts and later application writes while satisfying the constitution and spec.

**Alternatives considered**:
- Application-only audit management: rejected because it weakens consistency and makes seed/deployment scripts special cases.

## Decision 6: Seed by stable business keys, not environment-generated values

**Decision**: Seed applications, roles, and the super-admin deterministically using stable lookup values and fixed GUIDs defined in the seed scripts.

**Rationale**: Idempotency is easier to guarantee when seed scripts can upsert by unique business identity and preserve the same identifiers across environments.

**Alternatives considered**:
- Generate random GUIDs during deployment: rejected because it breaks deterministic relationships across reruns.

## Decision 7: Use the actual repository layout for implementation planning

**Decision**: Plan assets and future implementation should follow `database/schema`, `database/seed`, `database/views`, `src/api`, `src/frontend`, and `tests` as documented in the repository structure.

**Rationale**: The repository already defines a concrete architecture. The plan should reinforce that structure rather than introduce a parallel one.

**Alternatives considered**:
- Introduce a new `backend/` subproject layout in the plan: rejected because it does not match the current repo.

## Decision 8: Standardize UTC audit source and staging key type

**Decision**: Use database-generated UTC timestamps (`SYSUTCDATETIME()`) for audit defaults and update handling in migration/seed SQL, and standardize `stage.EngagementUsageRaw.StageId` as `UNIQUEIDENTIFIER`.

**Rationale**: The spec contains conflicting wording around UTC generation. Constitution Principle I requires durable, auditable, and reproducible data behavior. Database-side UTC defaults/triggers keep migration and seed execution deterministic across environments. A `UNIQUEIDENTIFIER` `StageId` aligns with other core entities and simplifies cross-table consistency.

**Alternatives considered**:
- Application-generated timestamps only: rejected because seed/migration correctness would depend on each caller implementation.
- `BIGINT` staging key: rejected because it introduces mixed key strategies without a current scale need.

## Execution Notes (Phase 7 Validation)

- Foundation assets are implemented under `database/` and `tests/` according to `tasks.md`.
- Validation scripts were authored to support local schema checks, seed integrity checks, and external Mercury connectivity checks.
- External Mercury checks require environment-specific credentials and network routing; execute in Mercury-connected context before production promotion.
- Local execution performed against `(localdb)\\MSSQLLocalDB` database `DashboardFoundationTemp`:
	- Local schema, audit, unique-constraint, staging append-only, and seed integrity checks returned PASS.
	- Seed counts validated as Applications=5, Roles=3, Users=1, UserRoles=1, UserApplications=5.
	- External Mercury read check returned expected FAIL in local context: `Invalid object name 'vw_USTaxBTS_FY26_MaxACD'`.