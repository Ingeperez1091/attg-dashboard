<!--
  Sync Impact Report
  ====================
  Version change: 1.0.0 -> 1.1.0 (architecture and maintainability principles amendment)
  
-->

# BTS Quarterly Metrics Dashboard Constitution

## Core Principles

### I. Data Integrity First

All data transformations between source systems and the dashboard
MUST be traceable and auditable. Numerator/denominator calculations
MUST be validated before display. Every metric shown on the
dashboard MUST be reproducible from its source data.

- Raw source data MUST be preserved in staging tables before any
  transformation or filtering is applied.
- Adoption percentage calculations (Numerator / Denominator) MUST
  use validated, denominator-matched records only.
- Historical metric snapshots MUST be stored with calculation date,
  application, counts, and revenue breakdowns to support trend
  analysis and audit.
- Data type coercions (numeric, datetime, string) MUST follow the
  documented coercion rules and treat parse failures as nulls
  (`errors='coerce'` semantics), never silently discard rows.
- All database tables MUST include `CreateDate`, `CreatedBy`,
  `UpdateDate`, and `UpdatedBy` audit columns.

### II. Configuration-Driven Business Rules

Denominator filter rules and numerator classification mappings
MUST be configurable through the application interface, not
hardcoded in source code.

- Each application (Maestro, EYST, Prodigy, Vector, Navigate)
  MUST have its own independently configurable rule set covering
  service codes, date ranges, engagement statuses, revenue
  thresholds, and name inclusion/exclusion patterns.
- Numerator filter rules MUST support dynamic field-operator-value
  expressions (e.g., `Region = US`, `Budget >= 20000`).
- Users with the `application_owner` role MUST be able to set
  numerator and denominator filters for their assigned
  applications. Viewers MUST NOT edit filter configuration.
- Rule changes MUST preview their impact on denominator/numerator
  counts before being applied.
- All rule modifications MUST be audit-logged with the user who
  changed them, the previous values, and a timestamp.

### III. Validated Data Ingestion

All incoming data — whether from API endpoints, system exports,
or manual uploads — MUST be validated against the denominator
before being accepted into the numerator store.

- The JSON-based numerator intake endpoint MUST store payloads in
  the `stage.EngagementUsageRaw` staging table before any
  processing occurs.
- Asynchronous processing MUST validate IDs against the current
  denominator, reject duplicates, and record validation results.
- The pipeline MUST validate numerator data using the application-
  specific filter rules defined in configuration.
- The pipeline MUST filter denominator data using the application-
  specific denominator rules before metric calculation.
- Invalid or unmatched IDs MUST be surfaced to the user with
  clear error context; they MUST NOT silently inflate or deflate
  adoption metrics.
- Upload metadata (user, timestamp, source file/endpoint) MUST be
  persisted for every ingestion event.

### IV. Test-First Development with Deterministic Isolation

Automated tests MUST be written before implementation for all
data pipeline logic, API endpoints, and business rule evaluation.
Tests MUST run in isolation with deterministic, reproducible state
to ensure CI/CD reliability and avoid environment-coupled failures.

- Red-Green-Refactor cycle: write failing tests, implement to
  pass, then refactor. No production code without a covering test.
- All tests MUST run against isolated in-memory repositories in
  test mode (`NODE_ENV=test`); no external databases or running
  dev servers are required.
- Test server MUST be auto-bootstrapped by Vitest global setup on
  a dedicated port (3110) with deterministic state; manual server
  startup is NOT required for test execution.
- Each test run MUST use a clean, file-backed in-memory store
  (shared across workers for determinism); test state MUST NOT
  leak between test files or cross into development environments.
- All test-sensitive environment variables (DEV_SESSION_USER_ID,
  USE_INMEMORY_REPOSITORY, etc.) MUST be ignored during test
  execution except when explicitly overridden for specific
  scenarios.
- Data pipeline tests MUST verify filter rules produce correct
  denominator populations and numerator matches using known
  fixture data.
- API contract tests MUST validate request/response schemas,
  status codes, and error payloads.
- Integration tests MUST cover the end-to-end flow: ingest →
  stage → validate → filter → calculate → display.
- Test runs MUST complete deterministically with no hanging
  processes or resource leaks; server teardown MUST clean up
  all handles and child processes reliably.

### V. Security & Role-Based Access Control

User authentication MUST be enforced via Azure AD SSO. Role-based
authorization MUST gate all operations according to three defined
roles: `administrator`, `application_owner`, `viewer`.

- The dashboard MUST require authenticated Azure AD sessions;
  anonymous access is prohibited.
- Exactly one role is allowed per user at any point in time.
  The allowed roles are: `administrator`, `application_owner`,
  `viewer`.
- Administrators MUST have access to all applications and all
  functionality, including the User Administration tab.
- Application owners MUST only view and edit filter controls for
  their assigned applications. Viewers MUST have read-only access
  to their assigned applications only.
- The User Administration tab and route MUST be accessible only to
  `administrator` users. Non-admin users MUST NOT access it, even
  via direct route navigation.
- Administrators MUST be able to create users with core identity
  fields (identity key, email, display name, active state), soft-
  delete users (set inactive — no hard delete), assign roles, and
  assign users to one or many applications (including an "All
  Applications" shortcut). Duplicate per-user application links
  MUST be prevented.
- All API endpoints MUST validate authorization before processing;
  unauthorized requests MUST return HTTP 401/403 without leaking
  internal details.
- Input from external sources MUST be sanitized against injection
  attacks.
- A super-admin user MUST be seeded on initial deployment with
  access to all features for all applications.

### VI. Incremental Delivery

Features MUST be delivered as independently testable MVP slices,
following the phased roadmap derived from stakeholder priorities.

- MVP: Seed initial application data; user administration; filter
  settings per application based on role; API endpoint to receive
  and store numerator data in SQL. Basic error handling
  ("Failed to load data" on failure).
- Extended-MVP: Azure AD SSO enforcement; role-based data
  visibility and editing restrictions; numerator validation
  pipeline; initial metrics calculation and display according to
  role and application assignment.
- Phase 2 (Denominator Rules Configuration): configuration UI for
  denominator filter rules so business owners can adjust criteria
  without code changes.
- Phase 3 (API Integration): connect to Maestro and Prodigy APIs
  for automated numerator data, retaining manual intake as
  fallback/override.
- Each phase MUST be independently deployable and demonstrable.
  Later phases MUST NOT break functionality delivered in earlier
  phases.

### VII. Clean Architecture and Maintainability

The codebase MUST preserve clear architectural boundaries, avoid
duplication, keep coupling low, and actively remove unused code.

- Business rules and workflow orchestration MUST live in
  `core/application`; route handlers and UI components MUST stay
  thin and must not embed business logic.
- Domain contracts (entities, value objects, repository
  interfaces) MUST have a single canonical source in
  `core/domain`; duplicate contract definitions across utility or
  adapter layers are prohibited.
- Persistence logic (SQL queries, repository implementations,
  runtime repository selection) MUST remain in infrastructure
  adapters and MUST NOT leak into API routes or UI code.
- New features MUST favor low coupling and high cohesion: modules
  should depend on stable abstractions and expose minimal
  interfaces.
- Unused code, components, tests, and obsolete compatibility
  layers MUST be removed as part of normal refactor and feature
  work.
- Architectural simplification is a requirement: if two modules
  serve the same concern, they MUST be consolidated into one
  authoritative implementation.

## Technology Stack & Constraints

- **Frontend**: Next.js with TypeScript. The dashboard MUST
  provide three primary views: Application Usage tab, Filtering
  Configuration tab, and User Administration tab (admin only).
- **Backend API**: Next.js API routes (or standalone Node.js
  service) exposing JSON endpoints for numerator intake,
  business rule management, user administration, and metric
  retrieval.
- **Database**: Azure SQL Server. Denominator data exposed
  through a SQL view; numerator staging in
  `stage.EngagementUsageRaw`; calculated metrics in dedicated
  metric tables. Initial application data MUST be seeded.
- **Authentication**: Azure AD SSO (Extended-MVP and beyond).
- **Data Ingestion**: Azure Data Factory for weekly Mercury
  (denominator) loads. Numerator data received via JSON API
  endpoint per application.
- **Infrastructure**: All Azure resources MUST be provisioned
  using Terraform (`infra/terraform/`) with isolated dev and prod
  workspaces. Remote state backend on Azure Blob Storage.
- **CI/CD**: GitHub Actions. Baseline CI workflow merged to trunk
  before any feature source code. CD workflow activated post-MVP
  only; production deployments require manual approval.
- **Applications in Scope**: Maestro (engagement-level, auto),
  EYST (client-level, manual), Prodigy (client-level, auto),
  Vector (engagement-level, manual), Navigate (engagement-level,
  manual).
- **Performance**: Dashboard pages MUST render within 3 seconds
  under normal load. Metric recalculation after numerator
  ingestion MUST complete asynchronously without blocking the
  user session.

## Development Workflow & Quality Gates

- **Branching**: All feature work MUST be done on feature branches
  and merged via pull request.
- **Code Review**: Every pull request MUST be reviewed by at least
  one team member before merge. Reviewers MUST verify compliance
  with this constitution's principles.
- **Testing Gate**: PRs MUST pass all automated tests (unit,
  contract, integration) before merge is permitted.
- **CI Pipeline Gate**: A baseline CI pipeline MUST be established
  and merged into protected trunk branches (`main`/`master`, and
  `develop` when used) before feature source-code development
  begins. The pipeline MUST run on every pull request and fail on
  lint/type-check/test failures, blocking merge until required
  checks pass.
- **Dependency Security Gate**: Deprecated, end-of-life, or known-
  vulnerable package/tool versions MUST NOT be introduced or kept
  in active use across `src/`, `tests/`, `infra/`, `database/`,
  and CI/CD workflow/tooling definitions. Pull requests MUST
  upgrade or replace affected dependencies before merge.
- **CD Pipeline Gate**: A Continuous Deployment pipeline MUST NOT
  be activated for production until the full MVP
  (EPIC-BQM-001 through EPIC-BQM-007) is complete and validated.
  Staging deployments may auto-trigger on merge to `develop`.
  Production deployments MUST require a manual approval step.
  Secrets MUST be sourced from Azure Key Vault — never hardcoded.
- **Infrastructure as Code Gate**: All Azure resources MUST be
  provisioned via Terraform (`infra/terraform/`). No manual
  Azure portal resource creation is permitted after initial
  bootstrapping. Terraform state MUST be stored in a remote
  Azure Blob Storage backend. Dev and prod environments MUST use
  isolated Resource Groups with no shared secrets.
- **Local Development Checklist**: Before any feature testing,
  verify: backend runs without errors; frontend runs and loads;
  frontend points to correct backend URL; backend CORS allows
  the frontend origin; browser console shows no connection errors.
- **Documentation**: Significant business rule changes or new
  application onboarding MUST be reflected in the stakeholder
  documents and this constitution as applicable.
- **Architecture Integrity Gate**: Pull requests MUST verify that
  business logic, domain contracts, and persistence concerns
  remain in their designated layers with no duplicate
  implementations.
- **Dead Code Gate**: Pull requests MUST remove obsolete files and
  stale adapters introduced by refactors; unused code SHOULD NOT
  be retained "for later" without a tracked justification.

## Governance

This constitution supersedes all other development practices for
the BTS Quarterly Metrics Dashboard project. All pull requests
and code reviews MUST verify compliance with the principles
defined above.

- **Amendments**: Any change to this constitution MUST be
  documented with a version bump, rationale, and migration plan
  if the change affects existing functionality.
- **Versioning**: Constitution versions follow MAJOR.MINOR.PATCH
  semantic versioning. MAJOR for principle removals or
  redefinitions, MINOR for new principles or expanded guidance,
  PATCH for clarifications and typo fixes.
- **Compliance Review**: At each phase milestone, the team MUST
  review delivered work against this constitution and document
  any justified deviations.
- **Complexity Justification**: Any architectural complexity
  beyond what the current phase requires MUST be justified in
  the implementation plan's Complexity Tracking table.


## General Guidelines:

- Authentication MUST use Azure AD SSO and users must be auto-prompted to sign in on first visit.
- Authorization MUST enforce three roles only: `administrator`, `application_owner`, and `viewer`.
- Data ingestion MUST first land in staging tables and only then move into application tables through controlled processing procedures.
- All database tables MUST include `CreateDate`, `CreatedBy`, `UpdateDate`, and `UpdatedBy` audit fields.
- Security controls must include protections for SQL injection, CORS/CSRF concerns, transport security, and least privilege access.
- Non-prod and prod deployments are independent and must not share secrets.
- Unit and Playwright tests are required for shipped features.
- CI pipeline checks are required on all pull requests to protected branches (develop, main or master) and must include lint, type-check, and automated tests.
- Use only supported, non-deprecated, and non-vulnerable dependency/tool versions across all deliverables: `src/`, `tests/`, `infra/`, `database/`, and workflow automation. Any deprecated or insecure dependency MUST be upgraded, pinned to a secure supported version, or replaced before merge.
- Pull requests MUST include dependency security validation evidence for changed ecosystems (for example: npm audit, Terraform provider version review, and workflow action version review) and MUST fail quality gates when critical/high vulnerabilities are introduced.
- CD pipeline is gated to post-MVP: production deployments require manual approval and full MVP (EPIC-001 through EPIC-007) must be complete before the production gate is lifted.
- IaC: All Azure infrastructure must be provisioned via Terraform. No manual portal changes after initial bootstrapping. Terraform state in Azure Blob Storage remote backend. Dev/prod environments fully isolated.
- Features are defined and traceable through Spec-Kit spec files.
- Motif style guide and web components are integrated as UI foundation.
- The minimum test coverage percentage for business logic is 80%
- The solutions should be flexibe, easy to maintain, extend, and include new applications
- Follow Zero-Trust threat modeling.
- TLS-only endpoints on Azure App Service and Azure SQL to mitigate man-in-the-middle risk.
- Parameterized SQL access through `mssql` request bindings to mitigate SQL injection.
- Strict response security headers configured in Next.js.
- Origin validation on intake API endpoint.
- NextAuth session validation for authenticated routes.
- Role-based authorization checks for filtering edits.
- Separate non-prod and prod environments with isolated secrets.
- Project must contains all required files to make it deployable
- Include scripts and .sh files to make easier and faster the deployment and running the solution locally.
- Generate/update the readme file with the instructions to run/test the solution
- Generate/update a speckit readme file with instructions to implement Spec-Driven Development using the agents/prompts defined.

**Version**: 1.1.0 | **Ratified**: 2026-04-13 | **Last Amended**: 2026-04-30
