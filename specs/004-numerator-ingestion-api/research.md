# Phase 0 Research: Numerator Data Ingestion API

## Decision 1: Implement the endpoint using clean architecture boundaries with a route-only API adapter

**Decision**: Build `POST /api/numerator` under `src/frontend/app/api/numerator/route.ts` as a transport-only adapter. Place orchestration in `core/application/services`, repository contracts in `core/domain/repositories`, and SQL/in-memory repository implementations in `infrastructure/persistence`.

**Rationale**: The constitution requires clean architecture and low coupling. Keeping API routes thin prevents business logic and persistence leakage into transport code, improves testability, and aligns with existing `core` and `infrastructure` boundaries in the repository.

**Alternatives considered**:
- Put all logic directly in the route handler: rejected because it violates clean architecture boundaries and increases coupling.
- Create a standalone backend service: rejected because the current architecture and repository already center API behavior inside the Next.js application.

## Decision 2: Accept one application per request and store the raw payload as an opaque JSON blob in staging

**Decision**: The request contract will require one target application per submission and store the payload exactly as received in `stage.EngagementUsageRaw.PayloadJson`.

**Rationale**: The schema for `stage.EngagementUsageRaw` is purpose-built for raw staging, and the epic scope says the endpoint should receive the payload and persist it for downstream asynchronous processing. Keeping the payload opaque avoids prematurely coupling the endpoint to per-application business rules that belong to later pipeline phases.

**Alternatives considered**:
- Deep-validate application-specific payload fields at intake time: rejected because the stakeholder documents place business-rule filtering and denominator validation downstream, not in the request path.
- Allow multiple applications in one submission: rejected because the spec assumes one application per request and single-application authorization is simpler and safer.

## Decision 3: Use role-based authorization with application assignment checks for `application_owner`

**Decision**: Allow `administrator` users to ingest for any active in-scope application, allow `application_owner` only for applications assigned to that user, and reject `viewer` requests.

**Rationale**: This matches the constitution and the existing session model. The repository already exposes patterns for retrieving user application assignments and listing active applications, making this design consistent and implementable without introducing a new authorization subsystem.

**Alternatives considered**:
- Allow all authenticated users to submit: rejected because it violates the constitution's RBAC rules.
- Restrict ingestion to administrators only: rejected because the feature spec explicitly allows authorized non-admin uploaders and the platform already models application-scoped ownership.

## Decision 4: Use parameterized SQL via an environment-selected SQL repository, with in-memory fallback only where needed for test/dev parity

**Decision**: Follow the existing repository factory pattern to use `mssql` and parameterized queries when SQL environment variables are present, with an optional in-memory implementation for non-SQL test contexts if needed.

**Rationale**: The repo already uses this pattern for users, and the constitution requires protection against injection attacks and traceable audit storage. Parameterized SQL plus the stage table schema satisfy both requirements.

**Alternatives considered**:
- Hardcode direct SQL access inside the route: rejected because it bypasses the repo's current abstraction and makes testing harder.
- Require SQL for all tests with no abstraction: rejected because contract-level tests can often benefit from a lighter repository boundary while integration tests validate the real table.

## Decision 5: Test the endpoint with contract tests for HTTP behavior and integration tests for persisted staging records

**Decision**: Add contract tests for authentication, authorization, validation, and success responses, and add integration tests that verify actual rows are created in `stage.EngagementUsageRaw` with the expected metadata.

**Rationale**: The constitution requires API contract and integration coverage. The existing tests under `tests/contract/user-administration` and `tests/integration/user-administration` already establish the expected patterns.

**Alternatives considered**:
- Unit tests only: rejected because they do not verify the persisted staging state or the real HTTP contract.
- End-to-end browser tests only: rejected because this feature is API-first and does not require UI coverage in this slice.