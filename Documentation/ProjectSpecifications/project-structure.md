# BTS Quarterly Metrics Dashboard - Project Structure

> Version: 1.1.0
> Status: Active
> Architecture Reference: Documentation/ProjectSpecifications/architecture.md
> Constitution: .specify/memory/constitution.md v1.1.0

## 1. Repository Layout

```text
attganalyticsdashboard/
│
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── epic.md
│   │   ├── user_story.md
│   │   └── task.md
│   ├── workflows/
│   │   └── ci.yml
│   ├── agents/
│   ├── prompts/
│   └── copilot-instructions.md
│
├── .specify/
│   ├── memory/
│   │   └── constitution.md
│   └── templates/
│
├── database/
│   ├── schema/
│   │   ├── dbo/
│   │   │   ├── Applications.sql
│   │   │   ├── Roles.sql
│   │   │   ├── Users.sql
│   │   │   ├── UserApplications.sql
│   │   │   ├── DenominatorFilterRules.sql
│   │   │   ├── NumeratorFilterRules.sql
│   │   │   └── MetricSnapshots.sql
│   │   └── stage/
│   │       └── EngagementUsageRaw.sql
│   ├── views/
│   │   └── vw_DenominatorEngagements.sql
│   ├── seed/
│   │   ├── seed-applications.sql        # 5 applications initial data
│   │   ├── seed-roles.sql               # 3 roles
│   │   └── seed-superadmin.sql          # Super-admin user
│   ├── migrations/
│   └── rollback/
│
├── Documentation/
│   ├── Backlog/
│   |    ├── epics/                       # GitHub reference files for ADO epics
│   |    │   └── epic-XXX-<slug>.md
│   |    └── stories/                     # GitHub reference files for ADO stories
│   |        └── epic-XXX/
│   |            └── story-YYY-<slug>.md
|   |
│   ├── StakeholderDocuments/                # PRD and business context
│   |    ├── ApplicationGoals.md
│   |    ├── ApplicationFeatures.md
│   |    ├── AUTOMATED_SOLUTION_ARCHITECTURE.md
│   |    └── BUSINESS_RULES_AND_ETL_SUMMARY.md
│   |
│   └──  ProjectSpecifications/                      # Technical specifications (GitHub)
│       ├── architecture.md
│       ├── project-structure.md
│       └── assumptions.md
|
├── infra/
│   ├── terraform/
│   │   ├── main.tf                          # Root module: resource composition
│   │   ├── providers.tf                     # azurerm provider + version constraints
│   │   ├── variables.tf                     # Input variable declarations
│   │   ├── outputs.tf                       # Output values (SQL FQDN, App Service URL, KV URI)
│   │   ├── backend.tf                       # Remote state backend (Azure Blob Storage)
│   │   ├── terraform.tfvars.example         # Example values (never commit real .tfvars)
│   │   ├── resource_group.tf                # azurerm_resource_group per environment
│   │   ├── sql.tf                           # azurerm_mssql_server + azurerm_mssql_database
│   │   ├── app_service.tf                   # azurerm_service_plan + azurerm_linux_web_app
│   │   ├── key_vault.tf                     # azurerm_key_vault + secrets + role assignments
│   │   └── data_factory.tf                  # azurerm_data_factory + role assignments
│   └── README.md                            # Bootstrap, init, plan, apply, rollback docs
|
├── pipelines/                           # Azure Data Factory definitions
│   ├── denominator-weekly-load/
│   │   └── pipeline.json
│   ├── numerator-processing/
│   │   └── pipeline.json
│   └── linked-services/
│
├── scripts/                           # PS scripts
│   ├── ci/
│   │   └── validate-ci-locally.ps1
│   ├── database/
|
├── src/
│   └── frontend/                        # Next.js TypeScript application
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx
│       │   ├── dashboard/               # Application Usage tab
│       │   ├── filters/                 # Filter Configuration tab
│       │   │   ├── numerator/
│       │   │   └── denominator/
│       │   ├── admin/                   # User Administration tab
│       │   |   └── users/
|       |   │ 
|       │   └── api/                             # Next.js API routes (or standalone)
│       |       ├── numerator/
│       |       │   └── route.ts                 # POST — ingest numerator JSON
│       |       ├── filters/
│       |       │   ├── numerator/
│       |       │   │   └── [appId]/route.ts     # GET/PUT numerator filter rules
│       |       │   └── denominator/
│       |       │       └── [appId]/route.ts     # GET/PUT denominator filter rules
│       |       ├── metrics/
│       |       │   └── [appId]/route.ts         # GET calculated metrics
│       |       ├── users/
│       |       │   ├── route.ts                 # GET/POST users
│       |       │   └── [userId]/
│       |       │       ├── route.ts             # PUT/DELETE (soft) user
│       |       │       └── applications/
│       |       │           └── route.ts         # GET/POST/DELETE user-app links
│       |       └── applications/
│       |           └── route.ts                 # GET applications list
│       |
│       ├── components/                  # Shared UI components (Motif WC)
│       ├── lib/
│       │   ├── api/                     # API client utilities
│       │   ├── auth/                    # Azure AD SSO integration
│       │   └── types/                   # TypeScript type definitions
│       ├── core/
|       |   ├── application/
|       |   |   ├── dto/
|       |   |   └── services/
|       |   └── domain/
|       |       ├── entities/
|       |       ├── repositories/
|       |       └── value-objects/
|       |
|       ├─ infrastructure/
|       |   ├── config/
|       |   ├── factories/
|       |   └── persistence/
|       |       ├── database/
|       |       ├── memory/
|       |       └── runtime/
|       |
|       ├─ lib/
|       |  ├── api/
|       |  ├── auth/
|       |  ├── db/
|       |  ├── di/
|       |  ├── types/
|       |  └── validation/
|       |
|       ├── next-env.d.ts
|       └── tsconfig.json

├── public/
│       ├── next.config.js
│       ├── tsconfig.json
│       └── package.json
|
├── tests/
│   ├── unit/
│   ├── integration/
│   └── contract/
│
├── eslint.config.js
├── package.json
├── README.md
├── tsconfig.json
├── vitest.config.ts
└── .gitignore

```

## 2. Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Branches | `feature/<epic-code>/<short-slug>` | `feature/BQM-001/db-schema` |
| SQL Tables | PascalCase, singular | `MetricSnapshots` |
| SQL Views | `vw_` prefix, PascalCase | `vw_DenominatorEngagements` |
| SQL Staging | `stage.` schema prefix | `stage.EngagementUsageRaw` |
| API Routes | kebab-case paths | `/api/filters/numerator/[appId]` |
| TypeScript files | camelCase for files, PascalCase for components | `filterRules.ts`, `FilterPanel.tsx` |
| Epic reference files | `epic-XXX-<slug>.md` | `epic-001-database-foundation.md` |
| Story reference files | `story-YYY-<slug>.md` inside `epic-XXX/` | `epic-001/story-001-schema-creation.md` |

---

## 3. Branching Strategy

- All feature work on feature branches: `feature/<epic-code>/<slug>`.
- Merge via pull request with at least one reviewer.
- PRs must pass all automated tests before merge.
- Reviewers verify compliance with the constitution's principles.

---

## 4. Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js, TypeScript, Motif Web Components |
| Backend API | Next.js API Routes (or standalone Node.js) |
| Database | Azure SQL Server |
| Authentication | Azure AD SSO (Extended-MVP) |
| Data Orchestration | Azure Data Factory |
| Infrastructure as Code | Terraform (`infra/terraform/`) — azurerm provider |
| CI | GitHub Actions (`.github/workflows/ci.yml`) — lint, type-check, tests, terraform validate |
| CD | GitHub Actions (`.github/workflows/cd.yml`) — build, deploy to Azure App Service, run migrations; **Post-MVP only** |

---

## 5. Clean Architecture Ownership

- app: transport and UI adapters only (Next.js routes/pages/components).
- core/domain: business entities, value objects, and repository interfaces.
- core/application: use-case orchestration and workflow/business rules.
- infrastructure: concrete implementations (database, in-memory, runtime selection, factories).
- lib: shared technical utilities (auth/session helpers, validation schemas, API helpers, DI helpers).

Dependency direction (must remain one-way):

- app -> core/application -> core/domain
- infrastructure -> core/domain
- app may depend on infrastructure only through composition/wiring boundaries.
- core/domain must not depend on app, infrastructure, or lib.

## 6. Structural Rules

- Keep one canonical source per concern. Do not duplicate repository contracts or configuration modules.
- Keep route handlers thin: validate input, invoke application services, map responses.
- Keep business rules in core/application services, not in route handlers or UI components.
- Keep persistence logic in infrastructure/persistence only.
- Remove dead code and unused components as part of each feature/refactor PR.

## 7. Technology Summary

- Frontend/API: Next.js + TypeScript
- Validation: Zod
- Data Access: mssql, Azure SQL Database
- Testing: Vitest (contract/integration), CI PowerShell contract checks
- Delivery: GitHub Actions CI scripts in scripts/ci

## 8. References

| Document | Path |
|----------|------|
| Architecture | `Documentation/ProjectSpecifications/architecture.md` |
| Constitution | `.specify/memory/constitution.md` |
| PRD — Application Goals | `Documentation/StakeholderDocuments/ApplicationGoals.md` |
| CI Pipeline Epic | `Documentation/Backlog/epics/epic-010-ci-pipeline.md` |
| Dashboard UI Grouping Epic | `Documentation/Backlog/epics/epic-014-dashboard-ui-grouping.md` |
| Azure IaC Epic | `Documentation/Backlog/epics/epic-011-azure-infrastructure-iac.md` |
| CD Pipeline Epic | `Documentation/Backlog/epics/epic-012-cd-pipeline.md` |
| Investment Data Onboarding Epic | `Documentation/Backlog/epics/epic-013-investment-data-onboarding-reconciliation.md` |
| Advanced Dashboard Time Controls Epic | `Documentation/Backlog/epics/epic-015-advanced-dashboard-time-controls.md` |
| AI-Assisted Rules and Insights Epic | `Documentation/Backlog/epics/epic-016-ai-assisted-rules-and-dashboard-insights.md` |

## 9. Backlog Structure Notes

- Implemented epic artifacts remain unchanged when new requirements emerge.
- Requirement deltas are captured by new or redefined non-implemented epics.
- New planning epic folders follow the same convention: `Documentation/Backlog/stories/epic-XXX/`.
- Current added planning folders: `Documentation/Backlog/stories/epic-013/`, `Documentation/Backlog/stories/epic-014/`, `Documentation/Backlog/stories/epic-015/`, `Documentation/Backlog/stories/epic-016/`.
