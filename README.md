# attganalyticsdashboard

ATTG Analytics Dashboard is a Next.js + TypeScript application for tracking EY application adoption metrics across tax engagements. It exposes a REST API for numerator ingestion, manages user administration and RBAC, and coordinates with an Azure SQL database for staging, processing, and reporting adoption data.

## Table of Contents

- [What This Project Does](#what-this-project-does)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Local Setup](#local-setup)
- [Database Migrations and Rollback](#database-migrations-and-rollback)
- [Environment Variables](#environment-variables)
- [Local SQL Connection](#local-sql-connection)
- [npm Scripts](#npm-scripts)
- [Testing](#testing)
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
│   └── database/                    # PowerShell migration and rollback runners
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

# Example: run only a subset
.\scripts\database\run-migrations.ps1 -ServerInstance ".\SQLEXPRESS" -Database "ATTG_Usage" -From 6 -To 7 -UseTrustedConnection
```

### 4. (Optional) Run rollback scripts

Use the rollback runner to execute scripts from `database/rollback` in descending order.

```powershell
# Default rollback range for Epic 005 migrations (009 down to 006)
.\scripts\database\run-rollback.ps1 -ServerInstance ".\SQLEXPRESS" -Database "ATTG_Usage" -UseTrustedConnection $true

# Example: rollback only 009 to 008
.\scripts\database\run-rollback.ps1 -ServerInstance ".\SQLEXPRESS" -Database "ATTG_Usage" -From 9 -To 8 -UseTrustedConnection $true
```

### 5. (Optional) Provision the local database

```powershell
.\scripts\database\setup-database.ps1 -UseTrustedConnection
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
| `From` | Starting migration index | `6` (migrations), `9` (rollback) |
| `To` | Ending migration index | `9` (migrations), `6` (rollback) |
| `UseTrustedConnection` | Use Windows auth (`sqlcmd -E`) | Off for migrations, On for rollback |

Notes:

- `sqlcmd` must be installed and available on PATH.
- Migration and rollback scripts stop on first SQL error (`sqlcmd -b`).

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

## Testing

Tests are organised by layer under `tests/`:

| Layer | Location | Purpose |
|-------|----------|---------|
| Contract | `tests/contract/` | Verify API route response shapes against spec |
| Integration | `tests/integration/` | Workflow-level tests across routes and repositories |

Test suites currently active (Vitest):

- `contract/user-administration`
- `contract/numerator-ingestion`
- `contract/filters/numerator-filter-config`
- `integration/user-administration`
- `integration/numerator-ingestion`
- `integration/filters/numerator-filter-config`

**Repository mode in tests:** Set `USE_INMEMORY_REPOSITORY=true` (the default in test setup) to run all suites without a live SQL database. SQL-backed suites can be enabled by pointing `SQL_*` env vars at a real database.

**Coverage thresholds (enforced):** 80% lines, statements, functions, and branches.

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
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