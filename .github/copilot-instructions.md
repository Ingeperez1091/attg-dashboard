# DashboardTest Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-05-08

## Active Technologies
- T-SQL for Azure SQL Database, plus repository-aligned Next.js TypeScript API integration context + Azure SQL Database, Azure DevOps pipeline execution, external Mercury SQL access, Azure AD identity metadata, JSON numerator payloads (001-database-foundation)
- Azure SQL Database for local application data; external Mercury-managed SQL database for denominator view access (001-database-foundation)
- T-SQL (Azure SQL Database, SQL Server 2022-compatible) with repository-aligned TypeScript/Next.js integration context + Azure SQL Database, Azure DevOps migration execution, external Mercury SQL view access, Azure AD identity metadata (001-database-foundation)
- Azure SQL Database (`app` and `stage` schemas); Mercury-managed external SQL view (`vw_USTaxBTS_FY26_MaxACD`) (001-database-foundation)
- TypeScript 5.x on Node.js 24.x (Next.js application context) + Next.js, React, Azure AD auth middleware/session context, Azure SQL access layer, Motif web components (003-user-admin)
- Azure SQL Database (`app.Users`, `app.Roles`, `app.UserApplications`, `app.Applications`) (003-user-admin)
- TypeScript 5.x on Node.js 24.x (Next.js application context), SQL (Azure SQL) + Next.js App Router API routes, Zod request validation, `mssql` parameterized SQL bindings, existing session/auth abstraction, repository factory/runtime selection in `src/frontend/infrastructure/persistence/runtime` (004-numerator-ingestion-api)
- Azure SQL Database staging table `stage.EngagementUsageRaw` (primary), optional deterministic in-memory repository for unit/contract tests (004-numerator-ingestion-api)
- TypeScript 5.x (Next.js app/API), T-SQL (Azure SQL Database), ADF pipeline JSON definitions + Next.js App Router API routes, existing auth/session abstractions, Zod validation, `mssql` parameterized SQL bindings, Azure Data Factory orchestration (007-validation-processing-pipeline)
- Azure SQL Database (`stage.EngagementUsageRaw`, `stage.DenominatorSnapshot`, `app.ValidationResults`, `app.MatchedRecords`, `app.PipelineRuns`, `app.FilterRuleSnapshots`) (007-validation-processing-pipeline)
- Azure SQL Database (`app.MetricSnapshots`, `app.PipelineRuns`, `app.FilterRuleSnapshots`, `app.AdoptionSettings`, `app.MatchedRecords`, interim synthetic investment facts table in `app` schema) (008-metrics-calculation-dashboard)
- TypeScript 5.x, Next.js App Router (frontend + API routes), SQL-backed metric persistence context from existing epics + Next.js, React, Motif web components, existing auth/session guards, existing metrics retrieval services/repositories, Zod validation, `mssql` bindings in data adapters (010-dashboard-ui-grouping)
- Azure SQL Database (read-only consumption for this epic via existing metric snapshot and run-status paths) (010-dashboard-ui-grouping)
- TypeScript 5.x (Next.js App Router) + Next.js 15, React 18, existing auth/session guard modules, Zod request validation, `mssql` parameterized SQL adapters (011-authentication-authorization)
- Azure SQL (`app.Users`, `app.Roles`, `app.UserRoles`, `app.UserApplications`) with in-memory repositories for deterministic tests (011-authentication-authorization)

- T-SQL (Azure SQL Database - TSQL 2022) + Azure SQL Database, Azure DevOps (for migration execution), Entity Framework Core 8.x (for application layer ORM), dapper (for low-level SQL operations in seed scripts) (001-database-foundation)

## Project Structure

```text
backend/
frontend/
tests/
```

## Commands

# Add commands for T-SQL (Azure SQL Database - TSQL 2022)

## Code Style

T-SQL (Azure SQL Database - TSQL 2022): Follow standard conventions

## Recent Changes
- 011-authentication-authorization: Added TypeScript 5.x (Next.js App Router) + Next.js 15, React 18, existing auth/session guard modules, Zod request validation, `mssql` parameterized SQL adapters
- 011-authentication-authorization: Added TypeScript 5.x (Next.js App Router) + Next.js 15, React 18, existing auth/session guard modules, Zod request validation, `mssql` parameterized SQL adapters
- 010-dashboard-ui-grouping: Added TypeScript 5.x, Next.js App Router (frontend + API routes), SQL-backed metric persistence context from existing epics + Next.js, React, Motif web components, existing auth/session guards, existing metrics retrieval services/repositories, Zod validation, `mssql` bindings in data adapters


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
