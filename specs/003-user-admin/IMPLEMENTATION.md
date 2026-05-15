# EPIC-BQM-002 Implementation Summary

This document summarizes the currently implemented User Administration and RBAC behavior.

## Linked design artifacts

- Spec: specs/003-user-admin/spec.md
- Plan: specs/003-user-admin/plan.md
- Research: specs/003-user-admin/research.md
- Data model: specs/003-user-admin/data-model.md
- API contract: specs/003-user-admin/contracts/user-admin-api-contract.md
- UI contract: specs/003-user-admin/contracts/admin-ui-access-contract.md
- API docs: specs/003-user-admin/API.md
- Tasks: specs/003-user-admin/tasks.md

## Dependencies

- Epic-001 Database Foundation (schema, seed data, audit conventions)
- Epic-010 CI Pipeline (validation gate expectations)

## Current architecture (implemented)

- Transport layer: Next.js route handlers under src/frontend/app/api/admin/users/**.
- Application layer: core/application/services/UserService.ts orchestration for user lifecycle, role updates, app assignments, and safeguards.
- Domain layer: canonical repository contracts under core/domain/repositories.
- Infrastructure layer: runtime repository selection under infrastructure/persistence/runtime/repositories.ts.

## Repository and runtime behavior

- Mode switch: USE_INMEMORY_REPOSITORY controls in-memory vs database mode.
- In-memory mode: deterministic repositories for tests and local fast iteration.
- Database mode: SQL repositories with parameterized queries only.
- Runtime repository bundle is shared via getRuntimeRepositories() to keep route/auth/test state consistent.

## Session and authorization behavior

- All admin-user endpoints use withAdminGuard().
- Session resolution supports:
	- Authorization bearer user id.
	- DEV_SESSION_USER_ID fallback in non-production.
- Authorization outcomes:
	- 401 when no active session is resolved.
	- 403 when user is not administrator.

## Implemented API surface

- GET /api/admin/users
- POST /api/admin/users
- GET /api/admin/users/{userId}
- PUT /api/admin/users/{userId}
- PUT /api/admin/users/{userId}/role
- GET /api/admin/users/{userId}/applications
- POST /api/admin/users/{userId}/applications
- DELETE /api/admin/users/{userId}/applications/{applicationId}
- PUT /api/admin/users/{userId}/active

Notable implemented rules:

- Create supports optional role and initial application assignments.
- PUT /api/admin/users/{userId} performs combined active/role/application update.
- PUT /active blocks deactivation of the last active administrator with 409 conflict.
- DELETE /applications/* is explicitly forbidden.

## Data-access configuration

- SQL connection can be sourced from DATABASE_URL, or composed from:
	- SQL_SERVER
	- SQL_INSTANCE
	- SQL_DATABASE
	- SQL_USER / SQL_PASSWORD
	- SQL_ENCRYPT
	- SQL_TRUST_SERVER_CERT
	- TRUSTED_CONNECTION

## Validation and observability

- Zod request schemas enforce route payload contracts (role enum, uuid app ids, xor app assignment input, active-state shape).
- Structured error mapping includes code/message/requestId.
- Request and mutation logging is implemented for traceability.
- User-create audit logging captures success and failure with sanitized payload fields.

## Validation and test coverage (implemented)

- Contract tests: create, role assignment, app assignment, active toggle.
- Integration tests: complete workflow, role/tab protection, application assignment lifecycle, error scenarios, audit logging, performance thresholds.
- Test runs default to in-memory mode for deterministic isolation.

## Status

- Core implementation for EPIC-BQM-002 is complete and aligned to current route/service structure.
- Remaining open tasks in tasks.md are operational/manual activities:
	- T056 Run feature locally end-to-end.
	- T058 Create pull request in GitHub.

## Local validation

Use quickstart instructions in specs/003-user-admin/quickstart.md for environment setup and command sequence.
