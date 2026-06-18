# attganalyticsdashboard

ATTG Analytics Dashboard is a Next.js + TypeScript application for tracking EY application adoption metrics across tax engagements. It exposes a REST API for numerator ingestion, manages user administration and RBAC, and coordinates with an Azure SQL database for staging, processing, and reporting adoption data.

## Table of Contents

- [attganalyticsdashboard](#attganalyticsdashboard)
  - [Table of Contents](#table-of-contents)
  - [What This Project Does](#what-this-project-does)
  - [Tech Stack](#tech-stack)
  - [Prerequisites](#prerequisites)
  - [Project Structure](#project-structure)
  - [Local Setup](#local-setup)
    - [1. Install dependencies](#1-install-dependencies)
    - [2. Configure environment](#2-configure-environment)
    - [3. (Optional) Run schema migrations](#3-optional-run-schema-migrations)
    - [4. (Optional) Run rollback scripts](#4-optional-run-rollback-scripts)
    - [5. (Optional) Provision the local database](#5-optional-provision-the-local-database)
    - [6. Start the dev server](#6-start-the-dev-server)
  - [Database Migrations and Rollback](#database-migrations-and-rollback)
  - [Environment Variables](#environment-variables)
    - [Microsoft Entra ID Callback URL](#microsoft-entra-id-callback-url)
    - [Testing Microsoft Entra SSO in development](#testing-microsoft-entra-sso-in-development)
  - [Logging \& Diagnostics](#logging--diagnostics)
    - [Log Channels](#log-channels)
    - [Operation Logger Phases](#operation-logger-phases)
    - [Log Line Format](#log-line-format)
    - [Filtering Logs in Production](#filtering-logs-in-production)
    - [Environment Variables for Logging](#environment-variables-for-logging)
    - [Security](#security)
  - [Local SQL Connection](#local-sql-connection)
  - [npm Scripts](#npm-scripts)
  - [Testing](#testing)
  - [Deployment Helpers](#deployment-helpers)
  - [CI Pipeline](#ci-pipeline)
  - [Contributing](#contributing)

## What This Project Does

The end-to-end flow:
1. Receive numerator data (JSON payloads) via `POST /api/numerator`
2. Stage and validate records in `stage.EngagementUsageRaw`
3. Cross-reference a local denominator snapshot (loaded weekly via ADF from Mercury)
4. Calculate adoption metrics per application
5. Display metrics and configuration in the dashboard UI

Five applications are in scope: **Maestro**, **EYST**, **Prodigy**, **Vector**, **Navigate**.

## Tech Stack

| Area | Technology |
|------|-----------|
| Runtime | Node.js 24.x |
| Language | TypeScript 5.x |
| Framework | Next.js 15 (App Router) |
| UI | React 18 |
| Validation | Zod 3 |
| Database driver | mssql 12 (Azure SQL) |
| Tests | Vitest 2 (contract + integration) |
| Linter | ESLint 9 + typescript-eslint 8 |

## Prerequisites

1. Node.js 24.x
2. npm (bundled with Node)
3. PowerShell 5.1+ (for database scripts)
4. SQL Server / SQL Express + `sqlcmd` (optional — only needed when `USE_INMEMORY_REPOSITORY=false`)

## Project Structure

```text
attganalyticsdashboard/
├── .github/
│   ├── copilot-instructions.md
│   └── workflows/
│       └── ci.yml                   # CI pipeline (lint → type-check → test → terraform)
├── database/
│   ├── migrations/                  # Ordered SQL migration scripts
│   ├── ps_scripts/                  # PowerShell setup and validation
│   ├── schema/                      # DDL per schema (app/, stage/)
│   ├── seed/                        # Seed data (applications, roles, super-admin)
│   └── views/                       # External access validation views
├── Documentation/
│   ├── Backlog/                     # Epic and story reference files
│   ├── ProjectSpecifications/       # Architecture, project structure, assumptions
│   └── StakeholderDocuments/        # PRD and business context
├── scripts/
│   ├── ci/                          # Local CI validation scripts
│   ├── database/                    # PowerShell migration and rollback runners
│   └── iis/                         # IIS deployment docs and helper scripts
├── specs/                           # Spec-kit feature specs and implementation plans
│   ├── 001-database-foundation/
│   ├── 002-baseline-ci-pipeline/
│   ├── 003-user-admin/
│   ├── 004-numerator-ingestion-api/
│   └── 005-numerator-filter-config/
├── src/
│   └── frontend/                    # Next.js application root
│       ├── app/
│       │   ├── admin/               # User admin UI pages
│       │   ├── api/                 # Next.js API routes
│       │   │   ├── admin/users/     # CRUD + role/application management
│       │   │   ├── applications/    # Application list
│       │   │   ├── numerator/       # POST — numerator ingestion
│       │   │   ├── roles/           # Role lookup
│       │   │   └── users/           # User self-service endpoints
│       │   ├── components/          # Shared UI components
│       │   ├── layout.tsx
│       │   └── page.tsx
│       ├── core/
│       │   ├── application/
│       │   │   ├── dto/             # Request/response shapes
│       │   │   └── services/        # Application services (e.g. NumeratorIngestionService)
│       │   └── domain/
│       │       ├── entities/        # Domain entities
│       │       ├── repositories/    # Repository interfaces
│       │       └── value-objects/
│       ├── infrastructure/
│       │   ├── config/
│       │   ├── factories/
│       │   └── persistence/
│       │       ├── database/        # SQL repository implementations
│       │       ├── memory/          # In-memory repository implementations
│       │       └── runtime/         # Repository factory + runtime selector
│       └── lib/
│           ├── api/                 # API error handling utilities
│           ├── auth/                # Auth guards and session resolution
│           ├── db/                  # SQL connection pool (pool.ts)
│           ├── di/                  # Dependency injection wiring
│           ├── types/               # Shared TypeScript types
│           └── validation/          # Zod schemas
├── tests/
│   ├── ci/                          # CI contract and integration scripts
│   ├── contract/
│   │   ├── database-foundation/
│   │   ├── numerator-ingestion/
│   │   ├── filters/numerator-filter-config/
│   │   └── user-administration/
│   └── integration/
│       ├── database-foundation/
│       ├── numerator-ingestion/
│       ├── filters/numerator-filter-config/
│       └── user-administration/
├── eslint.config.js
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create `src/frontend/.env.local` (copy the template below and fill in your values):

```env
# Repository mode: true = in-memory (no SQL), false = SQL
USE_INMEMORY_REPOSITORY=true

# SQL connection — only required when USE_INMEMORY_REPOSITORY=false
SQL_SERVER=<hostname>
SQL_INSTANCE=<instance>        # optional; ignored if SQL_PORT is set
SQL_PORT=1433                  # preferred over SQL_INSTANCE; avoids SQL Browser
SQL_DATABASE=<database name>
SQL_USER=<sql login>
SQL_PASSWORD=<password>
SQL_ENCRYPT=false
SQL_TRUST_SERVER_CERT=true
TRUSTED_CONNECTION=false       # set true for Windows integrated auth (requires msnodesqlv8)

# Local session fallback (dev only — maps to the seeded super-admin)
DEV_SESSION_USER_ID=30000000-0000-0000-0000-000000000001

AUTH_SECRET=local-dev-secret-change-me
AUTH_MICROSOFT_ENTRA_ID_ID=<entra app client id>
AUTH_MICROSOFT_ENTRA_ID_SECRET=<entra app client secret>
AUTH_MICROSOFT_ENTRA_ID_TENANT_ID=<entra tenant id>

# Pipeline execution mode: local (stored procedure) or adf (Azure Data Factory)
PIPELINE_EXECUTION_MODE=local

# Optional ADF trigger integration (used when PIPELINE_EXECUTION_MODE=adf)
ADF_PIPELINE_TRIGGER_ENDPOINT=<adf trigger endpoint url>
ADF_PIPELINE_TRIGGER_TOKEN=<optional bearer token>
```

### 3. (Optional) Run schema migrations

Use the migration runner to apply ordered SQL scripts from `database/migrations`.

```powershell
# Default range for Epic 005 migrations (006 through 009)
.\scripts\database\run-migrations.ps1 -ServerInstance ".\SQLEXPRESS" -Database "ATTG_Usage" -UseTrustedConnection

# Example: run with full SQL connection string
.\scripts\database\run-migrations.ps1 -ConnectionString "Server=attg.database.windows.net;Database=ATTG_Usage;User ID=your-user;Password=your-password;TrustServerCertificate=True;"

# Example: run with explicit SQL username/password
.\scripts\database\run-migrations.ps1 -ServerInstance "attg.database.windows.net" -Database "ATTG_Usage" -Username "your-user" -Password "your-password" -TrustServerCertificate

# Example: run only a subset
.\scripts\database\run-migrations.ps1 -ServerInstance ".\SQLEXPRESS" -Database "ATTG_Usage" -From 6 -To 7 -UseTrustedConnection
```

### 4. (Optional) Run rollback scripts

Use the rollback runner to execute scripts from `database/rollback` in descending order.

```powershell
# Default rollback range for Epic 005 migrations (009 down to 006)
.\scripts\database\run-rollback.ps1 -ServerInstance ".\SQLEXPRESS" -Database "ATTG_Usage" -UseTrustedConnection $true

# Example: rollback with full SQL connection string
.\scripts\database\run-rollback.ps1 -ConnectionString "Server=attg.database.windows.net;Database=ATTG_Usage;User ID=your-user;Password=your-password;TrustServerCertificate=True;"

# Example: rollback with explicit SQL username/password
.\scripts\database\run-rollback.ps1 -ServerInstance "attg.database.windows.net" -Database "ATTG_Usage" -Username "your-user" -Password "your-password" -TrustServerCertificate

# Example: rollback only 009 to 008
.\scripts\database\run-rollback.ps1 -ServerInstance ".\SQLEXPRESS" -Database "ATTG_Usage" -From 9 -To 8 -UseTrustedConnection $true
```

### 5. (Optional) Provision the local database

```powershell
.\scripts\database\setup-database.ps1 -UseTrustedConnection

# Example: setup with full SQL connection string
.\scripts\database\setup-database.ps1 -ConnectionString "Server=attg.database.windows.net;Database=ATTG_Usage;User ID=your-user;Password=your-password;TrustServerCertificate=True;"

# Example: setup with explicit SQL username/password
.\scripts\database\setup-database.ps1 -Server "attg.database.windows.net" -Database "ATTG_Usage" -Username "your-user" -Password "your-password" -TrustServerCertificate
```

### 6. Start the dev server

```bash
npm run dev
```

Open `http://localhost:3000`.

## Database Migrations and Rollback

PowerShell runners are located in `scripts/database`:

- `run-migrations.ps1`: applies `database/migrations/NNN_*.sql` in ascending order (`From <= To`)
- `run-rollback.ps1`: applies `database/rollback/rollback_NNN_*.sql` in descending order (`From >= To`)

Common parameters:

| Parameter | Description | Default |
|----------|-------------|---------|
| `ServerInstance` | SQL Server instance (for example `.\SQLEXPRESS`) | `.\SQLEXPRESS` |
| `Database` | Target database name | `ATTG_Usage` |
| `ConnectionString` | Full SQL connection string (can include server, database, auth, and trust options) | Empty |
| `Username` | SQL login username (requires `Password`) | Empty |
| `Password` | SQL login password (requires `Username`) | Empty |
| `From` | Starting migration index | `6` (migrations), `9` (rollback) |
| `To` | Ending migration index | `9` (migrations), `6` (rollback) |
| `UseTrustedConnection` | Use Windows auth (`sqlcmd -E`) | Off for migrations, On for rollback |

Notes:

- `sqlcmd` must be installed and available on PATH.
- Migration and rollback scripts stop on first SQL error (`sqlcmd -b`).
- Use either `UseTrustedConnection` or `Username`/`Password` for authentication.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `USE_INMEMORY_REPOSITORY` | Yes | `true` skips all SQL calls; use for fast local iteration |
| `SQL_SERVER` | When SQL | Hostname of the SQL Server instance |
| `SQL_INSTANCE` | No | Named instance (e.g. `SQLEXPRESS`); ignored when `SQL_PORT` is set |
| `SQL_PORT` | No | TCP port; preferred over `SQL_INSTANCE` (avoids SQL Browser) |
| `SQL_DATABASE` | When SQL | Target database name |
| `SQL_USER` | When SQL auth | SQL login username |
| `SQL_PASSWORD` | When SQL auth | SQL login password |
| `SQL_ENCRYPT` | No | `true`/`false` — whether to encrypt the connection |
| `SQL_TRUST_SERVER_CERT` | No | `true`/`false` — trust self-signed certs (useful for local SQL Express) |
| `TRUSTED_CONNECTION` | No | `true` for Windows integrated auth (requires `msnodesqlv8`) |
| `ENABLE_DEV_BYPASS` | Dev only | `true` keeps the local auth bypass on; set `false` to test Microsoft Entra SSO |
| `DEV_SESSION_USER_ID` | Dev only | Fallback user UUID when no auth header is present |
| `AUTH_SECRET` | Local + Prod | Auth.js signing/encryption secret |
| `AUTH_MICROSOFT_ENTRA_ID_ID` | SSO | Microsoft Entra app registration client ID |
| `AUTH_MICROSOFT_ENTRA_ID_SECRET` | SSO | Microsoft Entra app registration client secret |
| `AUTH_MICROSOFT_ENTRA_ID_TENANT_ID` | SSO | Microsoft Entra tenant ID |
| `PIPELINE_EXECUTION_MODE` | No | Pipeline trigger mode: `local` or `adf` (defaults by runtime client config) |
| `ADF_PIPELINE_TRIGGER_ENDPOINT` | When ADF | HTTP endpoint invoked to trigger the ADF pipeline run |
| `ADF_PIPELINE_TRIGGER_TOKEN` | No | Optional bearer token sent as `Authorization: Bearer <token>` when triggering ADF |

Troubleshooting note:
- If `PIPELINE_EXECUTION_MODE=adf` but `ADF_PIPELINE_TRIGGER_ENDPOINT` is empty, pipeline runs execute in local mode because no remote ADF endpoint is available.

### Microsoft Entra ID Callback URL

When configuring your Entra app registration, add this redirect URI:

- `http://localhost:3000/api/auth/callback/microsoft-entra-id`

### Testing Microsoft Entra SSO in development

To force real SSO instead of the dev bypass, set `ENABLE_DEV_BYPASS=false` in [src/frontend/.env.development.local](src/frontend/.env.development.local) and restart `npm run dev`.

## Logging & Diagnostics

The application emits structured JSON log lines to `stdout`/`stderr` for runtime diagnostics. Three log channels are used:

### Log Channels

| Prefix | File | Purpose |
|--------|------|---------|
| `[api-op]` | `lib/api/operation-logger.ts` | API route lifecycle (start, success, validation failure, auth failure, error) |
| `[request]` | `lib/api/request-logger.ts` | Request start/end with latency and status |
| `[audit]` | `lib/api/audit-logger.ts` | User creation success/failure and SSO identity binding |
| `[app-trace]` | `lib/runtime-trace.ts` | Low-level boot/session/SQL trace (opt-in via `APP_BOOT_TRACE=true`) |

### Operation Logger Phases

Every API route emits `[api-op]` logs at key lifecycle points:

| Phase | Level | When |
|-------|-------|------|
| `start` | info | Request received |
| `success` | info | Handler returned 2xx |
| `validation-failure` | warn | Zod schema validation failed |
| `auth-failure` | warn | 401/403 from auth guards |
| `error` | error | Unhandled exception or 4xx/5xx error |

### Log Line Format

```json
{
  "phase": "error",
  "method": "POST",
  "path": "/api/admin/users",
  "callerUserId": "30000000-0000-0000-0000-000000000001",
  "requestId": "a1b2c3d4-...",
  "status": 400,
  "latencyMs": 12,
  "error": { "name": "AppError", "message": "Username may only contain letters..." },
  "timestamp": "2026-05-21T14:30:00.000Z"
}
```

### Filtering Logs in Production

In Azure App Service Log Stream or Application Insights:

```text
# All API operation traces
[api-op]

# Only errors and exceptions
"phase":"error"

# Only validation failures (bad user input)
"phase":"validation-failure"

# Only auth failures (missing token, wrong role)
"phase":"auth-failure"

# Trace a specific request across all log channels
<requestId value>
```

### Environment Variables for Logging

| Variable | Required | Description |
|----------|----------|-------------|
| `APP_BOOT_TRACE` | No | Set to `true` to enable verbose `[app-trace]` logs (session resolution, SQL queries, repository calls). Disabled by default in production. |

### Security

- Sensitive fields (`password`, `token`, `secret`, `authorization`) are automatically stripped from log output.
- Error stack traces are truncated to 5 frames.
- User IDs are logged as-is for correlation; PII fields (email) are masked in `[app-trace]` channel.

## Authentication & Session Architecture

### Overview

The application uses a **WAF-safe session architecture** that avoids sending large cookies on every request. Authentication flows through Microsoft Entra ID (OAuth 2.0) via Auth.js v5, but the persistent session credential is a **Bearer token stored in `sessionStorage`** — not a cookie.

### Authentication Flow (Production SSO)

```
┌─────────┐     ┌────────────┐     ┌──────────────┐     ┌────────────────────┐
│ Browser │────▶│ /login      │────▶│ Microsoft    │────▶│ /api/auth/callback │
│         │     │ (sign-in)   │     │ Entra ID     │     │ (Auth.js handler)  │
└─────────┘     └────────────┘     └──────────────┘     └─────────┬──────────┘
                                                                    │
                                                                    ▼
                                                         ┌──────────────────────┐
                                                         │ Auth.js sets JWT     │
                                                         │ session cookie       │
                                                         │ (path: /api/auth)    │
                                                         └─────────┬────────────┘
                                                                   │ redirect
                                                                   ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Page loads → SessionProvider mounts → POST /api/auth/session-token              │
│   • Sends Auth.js cookie (scoped to /api/auth, so included)                     │
│   • Server verifies JWT, resolves internal user                                 │
│   • Returns AES-256-GCM encrypted Bearer token (15 min TTL)                    │
│   • Response also sets attg_sid cookie (HMAC-signed userId, ~80 bytes, path /) │
│   • Response clears the Auth.js session cookie (no longer needed)               │
└─────────────────────────────────────────────────────────────────────────────────┘
                                                                   │
                                                                   ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Client stores Bearer token in sessionStorage                                    │
│ Fetch interceptor attaches Authorization: Bearer <token> to all /api/* calls    │
│ AuthGuard resolves → page renders                                               │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Cookies

| Cookie | Path | Size | Purpose | Lifetime |
|--------|------|------|---------|----------|
| `attg_sid` | `/` | ~80 bytes | HMAC-signed userId for server-component auth | 24 hours |
| `authjs.session-token` | `/api/auth` | ~600 bytes | Auth.js JWT (only during OAuth exchange) | Cleared after token exchange |
| `authjs.callback-url` | `/api/auth` | ~50 bytes | Auth.js OAuth state | 120 seconds |
| `authjs.csrf-token` | `/api/auth` | ~150 bytes | Auth.js CSRF protection | 120 seconds |

The `authjs.session-token` is scoped to `/api/auth` so it is **never sent on page navigations** or regular API calls, avoiding WAF cookie-size interference.

### Session Resolution Priority (server-side)

When a server component or API route calls `getOptionalSession(request, repositories)`, identity is resolved in this order:

1. **Bearer token** (`Authorization: Bearer <token>` header) — used by client-side API calls via the fetch interceptor.
2. **Auth.js session** (`auth()` call) — fallback during OAuth callback, rarely used post-login.
3. **`attg_sid` cookie** (HMAC-signed userId at path `/`) — used by server components on page navigations after the initial token exchange.
4. **Dev bypass** (`dev_user_id` cookie or `DEV_SESSION_USER_ID` env var) — local development and e2e tests only.

### Client-Side Auth (AuthGuard + SessionProvider)

- `SessionProvider` (React context) manages the Bearer token lifecycle:
  - On mount: checks `sessionStorage` for an existing token → verifies via `POST /api/auth/verify`.
  - If no stored token: calls `POST /api/auth/session-token` to exchange the session cookie for a Bearer token.
  - Silent refresh: re-issues a fresh token every 10 minutes (before 15-min TTL expires).
- `AuthGuard` wraps all authenticated pages:
  - While loading: renders a loading indicator.
  - If no session: redirects to `/login?returnUrl=...`.
  - If session resolved: renders children.
- A **frozen fetch interceptor** (`Object.defineProperty` with `configurable: false`) automatically attaches the Bearer token to all `/api/*` requests (excluding `/api/auth/*`).

### Middleware

The middleware (`src/frontend/middleware.ts`) is a plain `NextRequest` function (not wrapped with `auth()`). It:

1. Normalizes IISNode pipe-prefixed paths.
2. Generates and propagates `x-request-id` and CSP nonce.
3. Passes through `/api/auth/*` routes unconditionally (OAuth flow).
4. **Deny-by-default** for other `/api/*` routes — requires a `Bearer` token in the `Authorization` header (or dev bypass in non-production).
5. Allows page routes through (client-side AuthGuard handles page auth).

### Token Structure

Bearer tokens are **AES-256-GCM encrypted + HMAC-SHA256 signed** using `SESSION_TOKEN_SECRET`. Claims include `userId`, `role`, `isActive`, `applications[]`, `oid`, `email`. Tokens are opaque to the client — they cannot be decoded without the server secret.

### Secret Rotation

Zero-downtime rotation is supported via `SESSION_TOKEN_SECRET_PREVIOUS`:
1. Set the new secret in `SESSION_TOKEN_SECRET`.
2. Move the old secret to `SESSION_TOKEN_SECRET_PREVIOUS`.
3. After 15 minutes (one full token TTL), remove `SESSION_TOKEN_SECRET_PREVIOUS`.

### Environment Variables (Auth)

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH_SECRET` | Yes | Auth.js signing/encryption secret |
| `SESSION_TOKEN_SECRET` | Yes | ≥32 chars. Encrypts/signs Bearer tokens and `attg_sid` cookie |
| `SESSION_TOKEN_SECRET_PREVIOUS` | No | Previous secret for zero-downtime rotation |
| `AUTH_MICROSOFT_ENTRA_ID_ID` | Prod | Microsoft Entra app registration client ID |
| `AUTH_MICROSOFT_ENTRA_ID_SECRET` | Prod | Microsoft Entra app registration client secret |
| `AUTH_MICROSOFT_ENTRA_ID_TENANT_ID` | Prod | Microsoft Entra tenant ID |
| `ENABLE_DEV_BYPASS` | Dev | `true` (default in dev) enables cookie-based dev login; `false` forces real SSO |
| `DEV_SESSION_USER_ID` | Dev | Fallback userId when no auth credential is present |

### Dev Bypass (Local Development & E2E Tests)

In non-production mode (unless `ENABLE_DEV_BYPASS=false`):
- `POST /api/auth/dev-login` sets a `dev_user_id` httpOnly cookie and returns the userId.
- The `dev_user_id` cookie is recognized by the middleware (allows API access) and by the session-token endpoint (issues a Bearer token without requiring Auth.js session).
- E2E tests use `page.context().addCookies()` to inject the `dev_user_id` cookie directly.
- Dev auth routes (`/api/auth/dev-*`) are **blocked in production** (returns 404).

## Local SQL Connection

When connecting to a SQL Express named instance locally, prefer `SQL_PORT` over `SQL_INSTANCE`:

- **`SQL_INSTANCE`** relies on SQL Browser service for named-instance discovery. If SQL Browser is stopped, connections time out after 15 seconds.
- **`SQL_PORT`** connects directly over TCP and bypasses SQL Browser entirely.

When both are set, `SQL_PORT` takes precedence.

```env
# Recommended for local SQL Express
SQL_SERVER=<hostname>
SQL_PORT=1433
# SQL_INSTANCE=SQLEXPRESS  ← not needed when SQL_PORT is set
```

To check whether SQL Browser is running:

```powershell
Get-Service -Name 'SQLBrowser' | Select-Object Name, Status
```

## npm Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `next dev src/frontend --webpack` | Start dev server with hot reload |
| `dev:sso` | `ENABLE_DEV_BYPASS=false` + `next dev src/frontend --webpack` | Start dev server with real Microsoft Entra SSO (bypass disabled) |
| `build` | `next build src/frontend` | Production build |
| `start` | `next start src/frontend` | Run production build |
| `type-check` | `tsc --noEmit` | Full TypeScript check |
| `lint` | `eslint src/frontend tests` | ESLint over app and test sources |
| `test` | `vitest run` | Run all contract and integration tests once |
| `test:watch` | `vitest` | Watch mode |
| `test:coverage` | `vitest run --coverage` | Tests with V8 coverage report |
| `e2e` | `npx playwright test` | Run Playwright end-to-end tests (auto-starts app on port 3001) |
| `e2e:headed` | `npx playwright test --headed` | Run Playwright tests with visible browser |
| `e2e:ui` | `npx playwright test --ui` | Open Playwright interactive UI runner |

## Testing

Tests are organised by layer under `tests/`:

| Layer | Location | Purpose |
|-------|----------|---------|
| Contract | `tests/contract/` | Verify API route response shapes against spec |
| Integration | `tests/integration/` | Workflow-level tests across routes and repositories |
| End-to-end (Playwright) | `tests/e2e/` | Validate user journeys in a real browser against the running app |

Test suites currently active (Vitest):

- `contract/user-administration`
- `contract/numerator-ingestion`
- `contract/filters/numerator-filter-config`
- `integration/user-administration`
- `integration/numerator-ingestion`
- `integration/filters/numerator-filter-config`

Test suites currently active (Playwright e2e):

- `e2e/pages/app-pages`
- `e2e/dashboard/dashboard-grouping`
- `e2e/dashboard/dashboard-filter-status-usability`

## Deployment Helpers

IIS deployment helper docs and scripts are located in `scripts/iis`:

- [scripts/iis/README_IIS_DEPLOYMENT.md](scripts/iis/README_IIS_DEPLOYMENT.md)
- [scripts/iis/IIS_DEPLOYMENT_GUIDE.md](scripts/iis/IIS_DEPLOYMENT_GUIDE.md)
- [scripts/iis/deploy-to-iis.ps1](scripts/iis/deploy-to-iis.ps1)
- [scripts/iis/test-local-server.bat](scripts/iis/test-local-server.bat)
- [scripts/iis/test-local-server.sh](scripts/iis/test-local-server.sh)

**Repository mode in tests:** Set `USE_INMEMORY_REPOSITORY=true` (the default in test setup) to run all suites without a live SQL database. SQL-backed suites can be enabled by pointing `SQL_*` env vars at a real database.

**Coverage thresholds (enforced):** 80% lines, statements, functions, and branches.

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Playwright e2e (headless)
npx playwright test

# Playwright e2e (headed)
npx playwright test --headed

# Playwright UI mode
npx playwright test --ui
```

## CI Pipeline

CI runs automatically on every pull request targeting `develop`, `main`, or `master`.

**Gates (in order):**

1. **Dependency Security** — enforces pinned action references; checks for `npm audit` vulnerabilities
2. **Lint** — ESLint over `src/frontend` and `tests`
3. **Type-check** — `tsc --noEmit` against root `tsconfig.json`
4. **Tests** — Vitest contract + integration suites (in-memory mode; no live DB required)
5. **Terraform validate** — auto-skipped when `infra/terraform/*.tf` is absent

Runner: `eyorg_windows_latest_8_32_A` · Node.js: `24.x`

All gates must pass before a PR can be merged.

**Reproduce CI locally:**

```bash
npm run lint
npm run type-check
npm test
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for branching conventions, PR requirements, and workflow expectations.