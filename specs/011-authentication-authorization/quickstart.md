# Quickstart: EPIC-BQM-005 Authentication and Authorization

**Feature Branch**: `011-authentication-authorization`  
**Date**: 2026-05-08

## Purpose

Implement and validate authenticated access, role-based authorization, and application-scoped visibility across protected dashboard routes and APIs.

## Prerequisites

- User, role, and assignment data model is present (`app.Users`, `app.Roles`, `app.UserRoles`, `app.UserApplications`).
- Seed scripts have provisioned initial super-admin.
- Existing route/service layers compile and current test suites are green.
- Microsoft Entra app registration exists with redirect URI `http://localhost:3000/api/auth/callback/microsoft-entra-id`.
- Local environment includes Auth.js v5 variables: `AUTH_SECRET`, `AUTH_MICROSOFT_ENTRA_ID_ID`, `AUTH_MICROSOFT_ENTRA_ID_SECRET`, `AUTH_MICROSOFT_ENTRA_ID_TENANT_ID`.

## Implementation Sequence

1. Harden session resolution contract
- Ensure protected requests require a resolved session principal.
- Keep development fallback (`DEV_SESSION_USER_ID`) non-production-only.

2. Centralize role and active-status checks
- Reuse/extend shared auth guard modules in `src/frontend/lib/auth`.
- Remove any duplicated inline route-level permission logic.

3. Enforce app-scope authorization
- Apply consistent scope assertions for app-scoped read/write endpoints.
- Verify admin bypass and non-admin restrictions.

4. Protect admin-only route surfaces
- Keep User Administration route/tab inaccessible to non-admin users, including direct navigation.

5. Normalize auth error semantics
- Ensure unauthenticated => `401`, unauthorized => `403`.
- Preserve non-leaky error message contract.

6. Wire production SSO path with Auth.js v5
- Configure Auth.js with Microsoft Entra provider (`src/frontend/auth.ts`) and App Router auth handlers (`/api/auth/[...nextauth]`).
- Add `/login` route for interactive sign-in and middleware redirects for protected routes.
- Resolve internal principal from Entra `oid` and auto-bind missing `azureAdObjectId` on first successful login.
- Keep `Authorization: Bearer <userId>` and non-production `DEV_SESSION_USER_ID` fallback behavior for automated tests/local API tooling.

## Verification Sequence

1. Contract tests
- 401 coverage for unauthenticated access on protected APIs.
- 403 coverage for authenticated callers lacking role/scope.
- Audit identity coverage for governed admin and filter mutations.

2. Integration tests
- Role matrix tests (`administrator`, `application_owner`, `viewer`) across protected route and API actions.
- Scope matrix tests for assigned vs unassigned application IDs.
- Admin route direct URL navigation behavior tests.
- Seeded super-admin and non-production `DEV_SESSION_USER_ID` fallback behavior.
- Stable non-security failure envelopes for authorized dashboard and filter reads.

3. Regression checks
- Existing feature APIs still function for authorized flows.
- No unintended permission broadening.

4. SSO-specific checks
- Unauthenticated browser navigation to `/admin/users`, `/dashboard`, `/filters` redirects to `/login?returnUrl=...`.
- Login page submits to Microsoft Entra provider.
- First successful SSO login for a known user with null `azureAdObjectId` binds the `oid` and emits `sso_identity_bind` audit log.
- Admin user create/edit UI does not expose `azureAdObjectId`, and create payload does not require it.

## Validation Commands

- `npm run type-check`
- `npm run test -- tests/contract/authentication-authorization/sso-session-mapping.contract.test.ts tests/integration/authentication-authorization/sso-user-lookup.integration.test.ts`
- `npm run test -- tests/contract/authentication-authorization tests/integration/authentication-authorization`
- `npm run test -- tests/integration/filters tests/contract/filters`

## Release Notes

- `DEV_SESSION_USER_ID` is only honored outside production.
- Audit logs for governed mutations now include the authenticated actor identity.
- Authorized read flows should continue to return the established response envelopes even when downstream dependencies fail.
- `azureAdObjectId` is now system-managed and auto-bound on first successful SSO login for known internal users.

## Suggested Local Commands

- `npm run lint`
- `npm run type-check`
- `npx vitest run tests/contract tests/integration`

## Done Criteria for Planning Phase

- Planning artifacts complete (`plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`).
- Constitution gate checks remain pass after design.
- Feature ready for `/speckit.tasks` decomposition.
