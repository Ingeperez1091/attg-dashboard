# BTS Quarterly Metrics Dashboard — System Architecture

> **Version**: 1.0.0  
> **Status**: Draft  
> **PRD Sources**: `Documentation/StakeholderDocuments/ApplicationGoals.md`, `Documentation/StakeholderDocuments/ApplicationFeatures.md`, `Documentation/StakeholderDocuments/AUTOMATED_SOLUTION_ARCHITECTURE.md`, `Documentation/StakeholderDocuments/BUSINESS_RULES_AND_ETL_SUMMARY.md`  
> **Constitution**: `.specify/memory/constitution.md` v1.0.0  
> **Changelog**: v1.5.0 — Added Section 4.8 (Impact Preview — Option D): staged rules table (`stage.DenominatorFilterRulesPreview`), existing pipeline SP reuse with `@previewSessionId` parameter, SSE streaming for result delivery, ADF direct call for async execution (MVP), stale run recovery (30min threshold), scale path (ADF → Worker, SSE → SignalR); supports EPIC-BQM-017 Feature A. v1.4.0 — Added Section 4.7 (Concurrency Control for Rules Configuration): optimistic concurrency via ConfigVersions, advisory edit sessions via ConfigEditSessions, conflict resolution UX; added tables ConfigVersions and ConfigEditSessions; supports EPIC-BQM-017 Feature C. v1.2.0 — Detailed ADF pipeline architecture from notebook ETL analysis; added PL_DenomLoad_Weekly, PL_MetricsProcessing, PL_MetricsOrchestrator pipelines; added per-app denominator rule tables from notebooks; added PipelineRuns, ValidationResults, MatchedRecords, FilterRuleSnapshots tables; performance optimisation notes (SP over Data Flows, OPENJSON, indexed views, parallel execution). v1.1.0 — Added Denominator Model metadata-driven architecture (DenominatorModels, DenominatorFilterRules); added AdoptionSettings section; updated ADF pipeline for dual-model lookups. v1.0.0 — External denominator database: `vw_USTaxBTS_FY26_MaxACD` resides on an independent Mercury-managed SQL server and may be unreachable from the ATTG_Usage database; architecture now mandates a local materialized copy (`stage.DenominatorSnapshot`) loaded weekly by ADF; all stored procedures and pipeline steps operate exclusively on the local copy; added assumption A25.

---

## 1. Business Objective

Calculate and visualize EY application adoption rates across tax engagements using the formula:

$$
\text{Adoption \%} = \frac{\text{Numerator (App Population)}}{\text{Denominator (Addressable Population)}} \times 100
$$

The system serves five applications — **Maestro**, **EYST**, **Prodigy**, **Vector**, **Navigate** — each with independently configurable business rules, data sources, and adoption levels (engagement vs. client).

---

## 2. Applications in Scope

| Application | Service Line | Sub-Service Line | Adoption Level | Numerator Source | Match Key |
|-------------|-------------|------------------|----------------|------------------|-----------|
| Maestro | Tax | Private Client Services | Engagement | Auto (API) | Engagement ID |
| EYST | Tax | Family Tax & Trust Services | Client | Manual → API | Client ID |
| Prodigy | Tax | R&D Tax Credit | Client | Auto (API) | Client ID |
| Vector | Tax | Tax Technology | Engagement | Manual → API | Engagement ID |
| Navigate | Tax | US Financial Planner Line | Engagement | Manual → API | Engagement ID |

All applications share the required properties: `ServiceLine`, `SubServiceLine`, `ApplicationName`, `IsActive`.

---

## 3. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA SOURCES                                   │
│                                                                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐   │
│  │  Mercury (Denom) │  │ Maestro / Prodigy│  │  Manual Uploads (JSON)   │   │
│  │ EXTERNAL SERVER  │  │  Auto API (Ph 3) │  │  EYST, Vector, Navigate  │   │
│  │  Weekly via ADF  │  │                  │  │                          │   │
│  └────────┬─────────┘  └────────┬─────────┘  └────────────┬─────────────┘   │
└───────────┼─────────────────────┼─────────────────────────┼─────────────────┘
            │ (ADF bridges        │                         │
            │  connectivity)      │                         │
            ▼                     ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           INGESTION LAYER                                   │
│                                                                             │
│  ┌───────────────────────┐    ┌───────────────────────────────────────────┐ │
│  │ Azure Data Factory    │    │  Next.js API — POST /api/numerator        │ │
│  │ Weekly Denominator    │    │  Receives JSON → stage.EngagementUsageRaw │ │
│  │ Load → local snapshot │    │  Validates auth, stores payload           │ │
│  └──────────┬────────────┘    └──────────────────┬────────────────────────┘ │
└─────────────┼────────────────────────────────────┼──────────────────────────┘
              │                                    │
              ▼                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     AZURE SQL DATABASE (ATTG_Usage)                         │
│                                                                             │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐   │
│  │ stage.Denominator-   │  │ stage.EngagementUsage│  │ Config Tables    │   │
│  │ Snapshot (local copy │  │ Raw (Staging)        │  │ - Applications   │   │
│  │ of external Mercury) │  │                      │  │ - FilterRules    │   │
│  └──────────┬───────────┘  └──────────┬───────────┘  │ - Users / Roles  │   │
│             │                         │              │ - UserApps       │   │
│             ▼                         ▼              └──────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    PROCESSING PIPELINE (ADF)                         │   │
│  │                                                                      │   │
│  │  1. Apply Denominator Filters (per app config)                       │   │
│  │     → Addressable Population                                         │   │
│  │  2. Validate Numerator IDs against Denominator                       │   │
│  │  3. Apply Numerator Filters (per app config)                         │   │
│  │  4. Match Numerator ∩ Denominator                                    │   │
│  │  5. Calculate Metrics (adoption %, revenue %)                        │   │
│  │  6. Store in MetricSnapshots table                                   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ MetricSnapshots Table                                                │   │
│  │ (CalculationDate, ApplicationId, DenominatorCount, NumeratorCount,   │   │
│  │  AdoptionPct, DenominatorRevenue, NumeratorRevenue, RevenuePct)      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                                   │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    Next.js Dashboard (TypeScript)                    │   │
│  │                                                                      │   │
│  │  ┌────────────────┐  ┌──────────────────┐  ┌────────────────────┐    │   │
│  │  │ Application    │  │ Filter Config    │  │ User Admin         │    │   │
│  │  │ Usage Tab      │  │ Tab              │  │ Tab (admin only)   │    │   │
│  │  └────────────────┘  └──────────────────┘  └────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Component Descriptions

### 4.1 Presentation Layer — Next.js Dashboard

| Aspect | Detail |
|--------|--------|
| Framework | Next.js with TypeScript |
| UI Library | Motif Web Components |
| Tabs | Application Usage, Filter Configuration, User Administration |
| Auth | Azure AD SSO (Extended-MVP) |
| Rendering | Server-side for initial load; client-side for interactions |
| Performance | Pages render within 3 seconds under normal load |

**Tab Access Matrix:**

| Tab | administrator | application_owner | viewer |
|-----|--------------|-------------------|--------|
| Application Usage | All apps | Assigned apps | Assigned apps |
| Filter Configuration | All apps (edit) | Assigned apps (edit) | Assigned apps (read-only) |
| User Administration | Full access | Hidden | Hidden |

#### 4.1.1 Dashboard UI Definitions

The Application Usage dashboard is defined as the following layout contract:

1. Hero area
  - Dashboard title and contextual business narrative.
  - Data freshness timestamp and latest successful `PipelineRunId`.
2. KPI row
  - KPI cards: Investment, Revenue, Average Engagement, On Target Rate.
  - Each card includes metric value, denominator basis label where applicable, and refresh timestamp.
3. Filter bar
  - Sub Service Line selector (all + single selection).
  - Revenue basis indicator (ETD/FYTD) sourced from application configuration.
4. Detail panel
  - Sub Service Line section rollups.
  - Product/application-level rows with status chip (`On Target` / `Below Target`).
  - Detail values: DenominatorCount, NumeratorCount, MatchedCount, Adoption %, Revenue %.
5. Footer legend
  - Metric definition version and KPI semantics reference.

#### 4.1.2 KPI Definitions

The dashboard displays these canonical KPI definitions, calculated deterministically server-side:

1. **Engagement Metric (Adoption Percentage)**
  - `engagement = Math.max(0, Math.min(100, AdoptionPct))`
  - `AdoptionPct = (NumeratorCount / DenominatorCount) * 100` [clipped to 0-100]
  - `NumeratorCount` and `DenominatorCount` are DISTINCT keys (ClientID or EngagementID based on `AdoptionLevel`)
  - Represents percentage of distinct addressable population that passed validation and denominator matching

2. **Revenue Share Metric (Revenue Percentage)**
  - `revenueShare = Math.max(0, Math.min(100, RevenuePct))`
  - `RevenuePct = (NumeratorRevenue / DenominatorRevenue) * 100` [clipped to 0-100]
  - `NumeratorRevenue` is summed from deduplicated numerator keys using the model metric field (`IsMetricDimension` source path)
  - `DenominatorRevenue` is summed from filtered denominator using `AdoptionSettings.RevenueMetric`
  - Revenue basis selection: `revenueBasis = FYTD | ETD` per `AdoptionSettings.RevenueMetric`
  - Represents percentage of addressable revenue captured by numerator scope

3. **On Target (High Adoption Indicator)**
  - `onTarget = isHighAdoption (engagement > 70%)`
  - UI-only boolean helper derived from adoption percentage and not persisted in `MetricSnapshots`
  - Binary indicator of high-adoption achievement
  - Default threshold: 70% (overridable via approved governance policy)

4. **Average Engagement Score**
  - `AvgEngagement = SUM(EngagementScores) / COUNT(DISTINCT EngagementId)`
  - Currently NULL; will be calculated once per-matched-record engagement data available

5. **Total Investment**
  - Uses authoritative investment facts when EPIC-BQM-013 is complete; otherwise uses interim synthetic values marked non-authoritative.

6. **Threshold Policy**
  - Engagement threshold policy defaults to 70% unless approved policy version overrides it.
  - Clipping ensures all percentages remain valid [0, 100] for audit and display.

#### 4.1.3 Data Grouping and Aggregation Contract

Dashboard aggregation and grouping follow a fixed hierarchy:

1. Portfolio level
  - Top-level KPI cards for the selected scope.
2. Sub Service Line level
  - Grouped rollups by `SubServiceLine`.
3. Product/Application level
  - Per-application metric rows within each group.
4. Time grouping
  - Revenue basis grouped by ETD/FYTD per application configuration.
  - Snapshot timeline grouped by `CalculationDate` for historical comparisons.

#### 4.1.4 UI Behavioral Requirements

1. Empty state
  - When no metric snapshots exist for scope, show a no-data state with clear user guidance.
2. In-progress state
  - When a pipeline run is active, show the latest completed snapshot with recalculation indicator.
3. Error state
  - If metrics endpoint fails, show a non-technical error message and preserve page structure.
4. Access scope
  - Non-admin users must only see assigned applications in all cards, groups, and detail rows.
5. Accessibility and responsive baseline
  - Dashboard filter controls are keyboard navigable.
  - Reduced-motion behavior is supported for non-essential transitions.
  - KPI cards and grouped detail layouts remain readable on mobile and desktop viewports.

#### 4.1.5 Ownership Boundary

- Dashboard UI composition, grouping, and baseline interaction behavior are owned by EPIC-BQM-014.
- Metric calculation, snapshot persistence, and interim dummy investment dataset generation are owned by EPIC-BQM-007.
- Advanced date controls, historical trend views, and benchmark alerts are owned by EPIC-BQM-015.
- AI-assisted denominator configuration and dashboard narrative analysis are owned by EPIC-BQM-016.

#### 4.1.6 AI Assistant Experience (Optional)

1. Denominator configuration assistance
  - Assistant can suggest denominator filter-rule sets and adoption settings from application context, prior approved rules, and current denominator schema metadata.
2. Dashboard analysis assistance
  - Assistant can provide narrative analysis of KPI behavior (trend shifts, below-target drivers, and notable variances) using governed metric outputs.
3. Human-in-the-loop control
  - AI suggestions are non-authoritative until reviewed and explicitly accepted by an authorized user.
4. Scope enforcement
  - Assistant responses are role-scoped and must only use data the requesting principal is authorized to access.

### 4.2 API Layer — Next.js API Routes

| Endpoint Group | Purpose |
|----------------|---------|
| `POST /api/numerator` | Receive JSON numerator payloads, store in `stage.EngagementUsageRaw` |
| `GET/PUT /api/filters/numerator/:appId` | Manage numerator filter rules per application |
| `GET/PUT /api/filters/denominator/:appId` | Manage denominator filter rules per application |
| `POST /api/assistant/denominator/:appId/rules` | Generate AI-proposed denominator filter rule drafts for review |
| `POST /api/assistant/denominator/:appId/settings` | Generate AI-proposed adoption-setting recommendations for review |
| `GET /api/metrics/:appId` | Retrieve calculated metrics for an application |
| `POST /api/assistant/dashboard/analysis` | Generate AI narrative analysis for authorized dashboard scope |
| `CRUD /api/users` | User creation, soft-delete, role assignment |
| `CRUD /api/users/:userId/applications` | Application assignment for users |
| `GET /api/applications` | List applications with metadata |

**API Security:**
- All endpoints validate authorization before processing.
- Unauthorized requests return `401`/`403` without leaking internals.
- Input from external sources is sanitized against injection attacks.
- AI suggestion endpoints require explicit request provenance and must persist acceptance/rejection audit metadata.

### 4.5 CI/CD Quality Gates

#### CI Pipeline (Baseline — Pre-Development)

| Stage | Required Checks |
|-------|------------------|
| Pull Request Validation | Lint, TypeScript type-check, unit/contract/integration tests |
| Merge Gate | All required CI checks pass; no failing quality gate |

**CI Requirements:**
- CI baseline workflow must be merged into trunk (`main`/`master`, and `develop` when used) before feature source code work starts.
- CI runs automatically on every pull request targeting protected branches (develop, main or master).
- CI failures block merge until resolved.
- Feature implementation should not move beyond setup tasks until CI pipeline baseline is in place on trunk.

#### CD Pipeline (Post-MVP — After EPIC-BQM-001 through EPIC-BQM-007 are complete)

| Stage | Trigger | Target |
|-------|---------|--------|
| Staging Deploy | Merge to `develop` | Azure App Service (dev) |
| Production Deploy | Merge to `main`/`master` + manual approval | Azure App Service (prod) |

**CD Requirements:**
- CD pipeline MUST NOT be activated for production until the full MVP (EPIC-BQM-001 through EPIC-BQM-007) is complete and validated.
- Secrets are sourced from Azure Key Vault — never hardcoded or stored in plain-text GitHub Secrets.
- CD includes database migration step against the target Azure SQL instance after every deployment.
- Failed deployments trigger an alert; rollback is achievable by re-running a previous successful workflow run.

### 4.6 Infrastructure as Code (Terraform)

All Azure resources MUST be provisioned and managed via Terraform under `infra/terraform/`. No manual Azure portal resource creation is permitted after initial bootstrapping.

| Resource | Terraform Resource Type | Environment |
|----------|------------------------|-------------|
| Resource Group | `azurerm_resource_group` | dev, prod |
| Azure SQL Server | `azurerm_mssql_server` | dev, prod |
| Azure SQL Database | `azurerm_mssql_database` | dev, prod |
| App Service Plan | `azurerm_service_plan` | dev, prod |
| App Service (Next.js) | `azurerm_linux_web_app` | dev, prod |
| Azure Data Factory | `azurerm_data_factory` | dev, prod |
| Azure Key Vault | `azurerm_key_vault` | dev, prod |
| Storage Account (state) | `azurerm_storage_account` | shared |

**IaC Requirements:**
- Terraform state MUST be stored in a remote Azure Blob Storage backend — local `.tfstate` files MUST NOT be committed to source control.
- Dev and prod environments use isolated Resource Groups; no shared secrets or resources between environments.
- Terraform `fmt` and `validate` checks MUST be included in the CI pipeline.
- Infrastructure changes are applied via `terraform plan`/`apply` — not via the Azure portal.

### 4.3 Database Layer — Azure SQL

#### Schema: `app` (Core)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `Applications` | Registry of the 5 in-scope applications | ApplicationId, Name, ServiceLine, SubServiceLine, AdoptionLevel, NumeratorSource, MatchKey, IsActive |
| `ApplicationModels` | Metadata defining field structure per application | ApplicationModelId, ApplicationId, FieldName, FieldType, SourcePath, IsFiltirable, IsMetricDimension, DisplayOrder |
| `Users` | User accounts | UserId, IdentityKey, Email, DisplayName, IsActive, RoleId |
| `Roles` | Three defined roles | RoleId, RoleName |
| `UserApplications` | Many-to-many user-app assignment | UserId, ApplicationId |
| `DenominatorModels` | Shared metadata defining Mercury view column schema (one row per column) | DenominatorModelId, FieldName, FieldType, SourceColumn, IsFiltirable, DisplayOrder |
| `DenominatorFilterRules` | Per-app denominator filter rules referencing `DenominatorModels` fields | RuleId, ApplicationId, DenominatorModelId, Operator, Value, SortOrder |
| `AdoptionSettings` | Per-app adoption-level configuration | SettingId, ApplicationId, AdoptionLevel, RevenueMetric, NumeratorSource |
| `NumeratorFilterRules` | Per-app numerator filter configuration | RuleId, ApplicationId, ApplicationModelId, Operator, Value |
| `MetricSnapshots` | Historical calculated metrics | SnapshotId, ApplicationId, CalculationDate, PipelineRunId, DenominatorCount, NumeratorCount, MatchedCount, AdoptionPct, DenominatorRevenue, NumeratorRevenue, RevenuePct |
| `PipelineRuns` | Pipeline execution tracking | RunId, ApplicationId, Status (Queued/Processing/Completed/Failed), StartTime, EndTime, TriggerSource, TotalRecordsIn, ValidCount, InvalidCount, DuplicateCount, FilteredOutCount, MatchedCount |
| `ValidationResults` | Per-record validation outcome | ResultId, PipelineRunId, StageId, ApplicationId, RecordKey, Status (Valid/Invalid/FilteredOut), ErrorMessage |
| `MatchedRecords` | Numerator records that passed all gates | MatchedId, PipelineRunId, ApplicationId, NumeratorKey, DenominatorKey, RevenueAmount |
| `FilterRuleSnapshots` | Point-in-time copy of rules used per run | SnapshotId, PipelineRunId, RuleType (Numerator/Denominator), RulesJson |
| `ConfigVersions` | Optimistic concurrency version per application per rule scope | ApplicationId, RuleScope, Version, LastModifiedBy, LastModifiedAt |
| `ConfigEditSessions` | Advisory edit session tracking for concurrent editing awareness | SessionId, ApplicationId, RuleScope, UserId, SessionStart, LastHeartbeat, IsActive |

#### Schema: `stage`

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `EngagementUsageRaw` | Staging for inbound numerator JSON | StageId, ApplicationId, PayloadJson, CreatedBy, CreateDate |
| `DenominatorSnapshot` | Local weekly copy of external Mercury view `vw_USTaxBTS_FY26_MaxACD` | SnapshotId, EngagementID, Engagement, ClientID, Client, AccountChannel, EngagementServiceCode, EngagementStatus, ReleaseDate, ETD_ANSRAmt, FYTD_ANSRAmt, … (all Mercury columns) |

#### Denominator Data — External View & Local Snapshot

> **CRITICAL**: The canonical denominator view `[InventoryAnalysis].[dbo].[vw_USTaxBTS_FY26_MaxACD]` resides on an **external, Mercury-managed SQL Server** that is independent of the ATTG_Usage application database. Direct cross-server queries (linked-server or `OPENROWSET`) **cannot be assumed** and may be blocked by network/firewall policy or credential isolation.

**Strategy — Local Materialized Copy:**

1. `PL_DenomLoad_Weekly` (ADF) reads the external source (Mercury export or direct Copy Activity to the external SQL view when connectivity permits) and writes to a **local staging table** `stage.DenominatorSnapshot` inside the ATTG_Usage database.
2. A local view `app.vw_DenominatorLocal` is created over `stage.DenominatorSnapshot` to provide a stable query interface for stored procedures.
3. **All downstream processing** (`usp_BuildFilteredDenominator`, ID validation JOINs, metric calculation) operates exclusively on `app.vw_DenominatorLocal` — never on the external view directly.
4. The local snapshot is a **full weekly refresh** (truncate + reload), not an incremental merge.

**Columns** (mirrored from Mercury view): Client ID, Client, Account Channel, Engagement ID, Engagement Status, Engagement Service Code, Release Date, Engagement, ANSR/Tech Revenue ETD, ANSR/Tech Revenue FYTD, TER ETD, TER FYTD.

#### Audit Columns

All tables include: `CreateDate`, `CreatedBy`, `UpdateDate`, `UpdatedBy`.

#### 4.3.1 Interim Investment Dummy Dataset (Non-Authoritative)

Until EPIC-BQM-013 delivers authoritative investment-source onboarding, non-production environments may use an interim synthetic investment dataset.

Contract:

1. Dataset is stored in SQL with explicit synthetic-data marking (`IsSynthetic = 1`).
2. Dataset is persisted in `app.InvestmentDummyFacts` (or equivalent approved table) in the `app` schema.
3. Records must include `ApplicationId`, `CalculationDate`, and synthetic investment value fields.
4. Seed scripts are deterministic and idempotent.
5. Synthetic values are never treated as authoritative production reporting sources.

#### Application Model Metadata

Each application has a **different dataset structure** for its numerator payload. Rather than hardcoding field definitions, the system uses a metadata-driven `ApplicationModels` table to declare each application's field schema. This enables:

- **Dynamic JSON parsing** — ADF reads field definitions (name, type, JSON source path) from `ApplicationModels` to parse `stage.EngagementUsageRaw.PayloadJson` without pipeline code changes.
- **Dynamic filter UI** — The Filter Configuration tab renders field dropdowns from `ApplicationModels` where `IsFiltirable = 1`, so the UI adapts to each application's data shape.
- **Single ADF pipeline** — One generic pipeline handles all applications by looking up model metadata, applying filters, and calculating metrics — no per-application pipeline branches.
- **Configurable metric dimensions** — Fields marked `IsMetricDimension = 1` are available for metric aggregation.

**ApplicationModels Table Structure:**

| Column | Type | Description |
|--------|------|-------------|
| `ApplicationModelId` | UNIQUEIDENTIFIER | Primary key |
| `ApplicationId` | UNIQUEIDENTIFIER | FK → `Applications` |
| `FieldName` | VARCHAR(100) | Logical field name (e.g., `NavigateStatus`, `EYSTActive`) |
| `FieldType` | VARCHAR(50) | Data type: `string`, `numeric`, `boolean`, `date` |
| `SourcePath` | VARCHAR(200) | JSON path within `PayloadJson` (e.g., `$.navigateStatus`) |
| `IsFiltirable` | BIT | Whether this field can be used in `NumeratorFilterRules` |
| `IsMetricDimension` | BIT | Whether this field is a metric dimension |
| `DisplayOrder` | INT | Ordering for UI display |

**Relationship to NumeratorFilterRules:**

`NumeratorFilterRules.ApplicationModelId` → `ApplicationModels.ApplicationModelId`. Filter rules reference model fields rather than arbitrary field names, ensuring referential integrity and enabling the UI to present only valid, filterable fields.

```
[Application]
       ↓
[ApplicationModels (metadata)]  →  defines numerator fields (per-app)
       ↓                                ↓
[NumeratorFilterRules]            [ADF JSON Parser]
  (references model fields)       (reads model to parse JSON)
       ↓                                ↓
[Generic ADF Pipeline: Validate → Filter → Calculate]
```

#### Denominator Model Metadata (Shared)

Unlike the numerator — where each application has a different JSON payload structure — the denominator data comes from a **single, fixed Mercury view** hosted on an **external server** (see A25), materialized locally as `stage.DenominatorSnapshot` / `app.vw_DenominatorLocal`. The metadata-driven approach uses a **shared** `DenominatorModels` table (no `ApplicationId`) that defines the Mercury view columns once. Per-application filter rules then reference these shared column definitions.

**Design Decision**: Independent tables (`DenominatorModels` + `DenominatorFilterRules`) were chosen over reusing `ApplicationModels` / `NumeratorFilterRules` because:

1. **No data duplication** — The Mercury view has ~17 columns. A shared model defines them once (17 rows) vs. per-app duplication (85 rows).
2. **ADF performance** — The pipeline makes ONE model lookup for denominator columns, then per-app filter rule lookups. No wasted per-app model reads.
3. **Semantic clarity** — Denominator fields (Mercury columns) are structurally different from numerator fields (JSON payload fields). Mixing them in one table would conflate two distinct data source schemas.
4. **Single ADF pipeline** — The generic pipeline reads denominator model → applies per-app denominator rules → reads numerator model per app → applies numerator rules → matches → calculates. Two metadata lookups, one pipeline.

**DenominatorModels Table Structure:**

| Column | Type | Description |
|--------|------|-------------|
| `DenominatorModelId` | UNIQUEIDENTIFIER | Primary key |
| `FieldName` | NVARCHAR(128) | Logical field name (e.g., `EngagementServiceCode`, `ReleaseDate`) |
| `FieldType` | NVARCHAR(32) | Data type: `string`, `number`, `date` |
| `SourceColumn` | NVARCHAR(256) | Actual Mercury view column name (e.g., `[EngagementServiceCode]`) |
| `IsFiltirable` | BIT | Whether this field can be used in `DenominatorFilterRules` |
| `DisplayOrder` | INT | Ordering for UI display |

**DenominatorFilterRules Table Structure:**

| Column | Type | Description |
|--------|------|-------------|
| `RuleId` | UNIQUEIDENTIFIER | Primary key |
| `ApplicationId` | UNIQUEIDENTIFIER | FK → `Applications` — rules are per-app |
| `DenominatorModelId` | UNIQUEIDENTIFIER | FK → `DenominatorModels` — references a Mercury column |
| `Operator` | NVARCHAR(32) | Comparison operator (EQ, NEQ, GT, GTE, LT, LTE, IN, NOT_IN, CONTAINS, NOT_CONTAINS) |
| `Value` | NVARCHAR(512) | Filter value (single value or comma-separated for IN/NOT_IN) |
| `SortOrder` | INT | Execution order |

**Relationship Diagram:**

```
[DenominatorModels (shared)]    ←───  [DenominatorFilterRules (per-app)]
  17 rows (Mercury columns)              N rows per application
         ↓                                       ↓
  ADF reads model once              ADF reads rules per ApplicationId
         ↓                                       ↓
  Dynamic SQL WHERE clause built from rules referencing model fields
```

**Mercury View Column Definitions (DenominatorModels Seed Data):**

| FieldName | FieldType | SourceColumn | IsFiltirable |
|-----------|-----------|--------------|-------------|
| EngagementID | string | `[EngagementID]` | No |
| Engagement | string | `[Engagement]` | Yes |
| ClientID | string | `[ClientID]` | No |
| Client | string | `[Client]` | Yes |
| AccountChannel | string | `[AccountChannel]` | Yes |
| EngagementSubServiceLine | string | `[EngagementSubServiceLine]` | Yes |
| EngagementServiceCode | string | `[EngagementServiceCode]` | Yes |
| EngagementService | string | `[EngagementService]` | No |
| EngagementStatus | string | `[EngagementStatus]` | Yes |
| CreationDate | date | `[CreationDate]` | Yes |
| ReleaseDate | date | `[ReleaseDate]` | Yes |
| ETD_ANSRAmt | number | `[ETD_ANSRAmt]` | Yes |
| FYTD_ANSRAmt | number | `[FYTD_ANSRAmt]` | Yes |
| ETD_TERAmt | number | `[ETD_TERAmt]` | Yes |
| FYTD_TERAmt | number | `[FYTD_TERAmt]` | Yes |
| ETD_ChargedHours | number | `[ETD_ChargedHours]` | No |
| FYTD_ChargedHours | number | `[FYTD_ChargedHours]` | No |

#### Adoption Settings

Adoption-level configuration is stored per application in the `AdoptionSettings` table:

| Column | Type | Description |
|--------|------|-------------|
| `SettingId` | UNIQUEIDENTIFIER | Primary key |
| `ApplicationId` | UNIQUEIDENTIFIER | FK → `Applications` (unique per app) |
| `AdoptionLevel` | NVARCHAR(32) | `Engagement` or `Client` |
| `RevenueMetric` | NVARCHAR(64) | Revenue column to use (e.g., `ETD_ANSRAmt`, `FYTD_ANSRAmt`) |
| `NumeratorSource` | NVARCHAR(32) | `API` or `Manual` |

The ADF pipeline reads `AdoptionSettings` per application to determine the match key type and which revenue column drives revenue-based adoption metrics.

#### Per-Application Payload Templates

Each application's numerator JSON payload must conform to the field structure defined in `ApplicationModels`. Below are the expected field definitions per application:

**Navigate** (Engagement-level)

| FieldName | FieldType | SourcePath | IsFiltirable | IsMetricDimension |
|-----------|-----------|------------|-------------|-------------------|
| EngagementId | string | `$.engagementId` | No | No |
| ClientId | string | `$.clientId` | No | No |
| ClientName | string | `$.clientName` | No | No |
| EngagementName | string | `$.engagementName` | No | No |
| RevenueFYTD | numeric | `$.revenueFYTD` | Yes | Yes |
| NavigateStatus | string | `$.navigateStatus` | Yes | Yes |
| Notes | string | `$.notes` | No | No |

Valid values for `NavigateStatus`: `Navigate`, `Non-Navigate`, `Inactive`, `Not Classified`.

**EYST** (Client-level)

| FieldName | FieldType | SourcePath | IsFiltirable | IsMetricDimension |
|-----------|-----------|------------|-------------|-------------------|
| ClientId | string | `$.clientId` | No | No |
| ClientName | string | `$.clientName` | No | No |
| EngagementCount | numeric | `$.engagementCount` | Yes | No |
| TotalRevenueETD | numeric | `$.totalRevenueETD` | Yes | Yes |
| EYSTActive | string | `$.eystActive` | Yes | Yes |
| EYSTDataCleanupActive | string | `$.eystDataCleanupActive` | Yes | Yes |
| Notes | string | `$.notes` | No | No |

Valid values for `EYSTActive` / `EYSTDataCleanupActive`: `Yes`, `No`.

**Prodigy** (Client-level)

| FieldName | FieldType | SourcePath | IsFiltirable | IsMetricDimension |
|-----------|-----------|------------|-------------|-------------------|
| ClientId | string | `$.clientId` | No | No |
| ClientName | string | `$.clientName` | No | No |
| EngagementCount | numeric | `$.engagementCount` | Yes | No |
| TotalRevenueFYTD | numeric | `$.totalRevenueFYTD` | Yes | Yes |
| InProdigy | string | `$.inProdigy` | No | Yes |
| Override | string | `$.override` | Yes | No |
| Notes | string | `$.notes` | No | No |

**Maestro** (Engagement-level)

| FieldName | FieldType | SourcePath | IsFiltirable | IsMetricDimension |
|-----------|-----------|------------|-------------|-------------------|
| EngagementId | string | `$.engagementId` | No | No |
| ClientId | string | `$.clientId` | Yes | No |
| ClientName | string | `$.clientName` | No | No |
| EngagementName | string | `$.engagementName` | No | No |
| InMaestro | boolean | `$.inMaestro` | Yes | Yes |

**Vector** (Engagement-level)

| FieldName | FieldType | SourcePath | IsFiltirable | IsMetricDimension |
|-----------|-----------|------------|-------------|-------------------|
| EngagementId | string | `$.engagementId` | No | No |
| ClientId | string | `$.clientId` | Yes | No |
| ClientName | string | `$.clientName` | No | No |
| RevenueFYTD | numeric | `$.revenueFYTD` | Yes | Yes |
| RevenueETD | numeric | `$.revenueETD` | Yes | Yes |
| VectorEngagement | string | `$.vectorEngagement` | Yes | Yes |

Valid values for `VectorEngagement`: `Yes`, `No`.

### 4.4 Data Processing — Azure Data Factory

ADF is the sole orchestration engine. Pipeline design is driven by the notebook ETL patterns (`StakeholderDocuments/notebooks/`) and optimised for performance: one shared denominator load, parameterised per-app processing, and minimal data movement.

#### 4.4.1 Pipeline Inventory

| Pipeline | Trigger | Description |
|----------|---------|-------------|
| **PL_DenomLoad_Weekly** | Weekly schedule (ADF trigger) | Extract denominator data from external Mercury source → Bulk load into local `stage.DenominatorSnapshot` table → Refresh `app.vw_DenominatorLocal` |
| **PL_MetricsProcessing** | On-demand (after numerator ingestion) or scheduled | Parameterised pipeline; receives `ApplicationId`. Runs all validation, filtering, matching, and metric calculation for one application per execution. |
| **PL_MetricsOrchestrator** | Scheduled or triggered by API | ForEach loop over active applications in `app.Applications` → invokes `PL_MetricsProcessing` per app. Enables parallelism (ADF concurrent batch setting = 5). |

#### 4.4.2 PL_DenomLoad_Weekly — Denominator Load Pipeline

```
 Step 1 — Copy Activity
   Source: External Mercury source.
           Option A: Excel report (Azure Blob or SFTP) — skipRows=6 (header).
           Option B: Direct ADF Copy Activity from external SQL Server view
                     [InventoryAnalysis].[dbo].[vw_USTaxBTS_FY26_MaxACD]
                     (requires ADF Linked Service with credentials; no
                     linked-server from ATTG_Usage DB needed).
   Sink  : Local staging table `stage.DenominatorSnapshot` (truncate + load)
   Config: Column mappings to standard names.
   NOTE  : The external Mercury DB is on a separate server. ADF bridges the
           connectivity gap — the application database never queries the
           external server directly.

 Step 2 — Stored Procedure Activity
   Exec: [stage].[usp_RefreshDenominatorLocal]
   Purpose: Coerce data types (numeric with NULL-on-failure, dates, strings),
            deduplicate within `stage.DenominatorSnapshot`,
            `app.vw_DenominatorLocal` view auto-refreshes (SELECT over
            stage.DenominatorSnapshot).

 Step 3 — Validation Activity (optional)
   Verify row count > 0; if zero → fail pipeline, send alert.
```

**Performance Notes:**
- Bulk load uses `TABLOCK` hint and minimal logging for fast inserts into `stage.DenominatorSnapshot`.
- `app.vw_DenominatorLocal` is indexed on `EngagementID` and `ClientID` for fast downstream lookups.
- Denominator data is loaded once per week into the local snapshot; per-app filtering happens at query time against the local copy.
- ADF is the only component that connects to the external Mercury server — no linked-server or `OPENROWSET` from ATTG_Usage.

#### 4.4.3 PL_MetricsProcessing — Per-Application Processing Pipeline

Parameterised on `ApplicationId`. Steps aligned with the notebook ETL patterns:

```
 ┌─────────────────────────────────────────────────────────────────┐
 │  Step 1: Configuration Lookups (parallel)                       │
 │  ┌─────────────────────────────────┐ ┌───────────────────────┐  │
 │  │ Lookup: AdoptionSettings        │ │ Lookup: App Models    │  │
 │  │  → adoptionLevel, revenueMetric │ │  → fields, sourcePaths│  │
 │  │  → matchKey (EngID or ClientID) │ │  → isFilterable flags │  │
 │  └─────────────────────────────────┘ └───────────────────────┘  │
 │  ┌─────────────────────────────────┐ ┌───────────────────────┐  │
 │  │ Lookup: DenominatorModels       │ │ Lookup: Denom Filter  │  │
 │  │  → shared column definitions    │ │   Rules (per app)     │  │
 │  └─────────────────────────────────┘ └───────────────────────┘  │
 │  ┌─────────────────────────────────┐                            │
 │  │ Lookup: Numerator Filter Rules  │                            │
 │  │  (per app, ref ApplicationModels│                            │
 │  └─────────────────────────────────┘                            │
 └─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
 ┌─────────────────────────────────────────────────────────────────┐
 │  Step 2: Build Filtered Denominator (SQL Stored Procedure)      │
 │                                                                 │
 │  Exec: [app].[usp_BuildFilteredDenominator]                     │
 │  Input: @ApplicationId, @DenomRulesJson (serialised rules)      │
 │  Output: Temp table #FilteredDenom with addressable population  │
 │                                                                 │
 │  Logic (mirrors notebook patterns):                             │
 │  - Start from app.vw_DenominatorLocal (local weekly copy)       │
 │  - Apply rules sequentially (AND-combined):                     │
 │    • Service Code: WHERE [EngagementServiceCode] IN (...)       │
 │    • Release Date: WHERE [ReleaseDate] > @cutoff                │
 │    • Engagement Status: WHERE [EngagementStatus] IN (...)       │
 │    • Revenue Threshold: WHERE [ETD_ANSRAmt] > @minRevenue       │
 │    • Name Exclusion: WHERE [Engagement] NOT LIKE @pattern       │
 │    • Name Inclusion: WHERE [Engagement] LIKE @pattern           │
 │    • Account Channel: WHERE [AccountChannel] = @channel         │
 │  - Record: total rows in, rows after each filter, rows out      │
 └─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
 ┌─────────────────────────────────────────────────────────────────┐
 │  Step 3: Parse & Validate Numerator                             │
 │                                                                 │
 │  3a. Read stage.EngagementUsageRaw (unprocessed for this app)   │
 │  3b. Parse JSON payloads using ApplicationModels SourcePath     │
 │      (OPENJSON with model-driven column definitions)            │
 │  3c. Data type coercion:                                        │
 │      • Numeric: TRY_CAST → NULL on failure (errors='coerce')    │
 │      • Date:    TRY_CAST → NULL on failure                      │
 │      • String:  LTRIM(RTRIM(...))                               │
 │  3d. Duplicate detection: ROW_NUMBER() OVER(PARTITION BY        │
 │      matchKey ORDER BY StageId DESC) — flag rn > 1              │
 │  3e. ID Validation: LEFT JOIN #FilteredDenom on matchKey        │
 │      • matched → valid                                          │
 │      • not matched → invalid ('ID not found in denominator')    │
 │      • NULL/empty ID → invalid ('Missing Engagement/Client ID') │
 │  3f. Write validation results to app.ValidationResults          │
 └─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
 ┌─────────────────────────────────────────────────────────────────┐
 │  Step 4: Apply Numerator Filter Rules                           │
 │                                                                 │
 │  Exec: [app].[usp_ApplyNumeratorFilters]                        │
 │  Input: @ApplicationId, @NumeratorRulesJson                     │
 │  Logic: Apply field-operator-value expressions (AND-combined)   │
 │  on validated-only records. Records failing any rule are        │
 │  marked 'filtered-out' with the specific rule that excluded     │
 │  them.                                                          │
 └─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
 ┌─────────────────────────────────────────────────────────────────┐
 │  Step 5: Match Numerator ∩ Denominator                          │
 │                                                                 │
 │  Logic per AdoptionSettings.AdoptionLevel:                      │
 │  • Engagement-level (Maestro, Vector, Navigate):                │
 │    INNER JOIN on EngagementID                                   │
 │  • Client-level (EYST, Prodigy):                                │
 │    INNER JOIN on ClientID (distinct clients)                    │
 │  Output: app.MatchedRecords (per pipeline run)                  │
 │                                                                 │
 │  Application-specific logic (from notebooks):                   │
 │  • Maestro: InMaestro boolean flag → match if TRUE              │
 │  • EYST: EYSTActive flag → match if 'Yes'                       │
 │  • Prodigy: Client_in_Prodigy flag → match if client exists     │
 │  • Vector: VectorEngagement flag → match if 'Yes'               │
 │  • Navigate: NavigateStatus → match if 'Navigate'               │
 └─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
 ┌─────────────────────────────────────────────────────────────────┐
 │  Step 6: Calculate Metrics & Persist Snapshot                   │
 │                                                                 │
 │  Formulas (per AdoptionSettings.RevenueMetric):                 │
 │  • Adoption % = COUNT(Matched) / COUNT(#FilteredDenom) × 100    │
 │  • Revenue  % = SUM(Matched.Revenue) / SUM(Denom.Revenue) × 100 │
 │                                                                 │
 │  Revenue column selection (per app, from AdoptionSettings):     │
 │  • Maestro  → ETD_ANSRAmt                                       │
 │  • EYST     → ETD_ANSRAmt                                       │
 │  • Prodigy  → FYTD_ANSRAmt                                      │
 │  • Vector   → ETD_ANSRAmt (threshold: > $10,000)                │
 │  • Navigate → FYTD_ANSRAmt                                      │
 │                                                                 │
 │  INSERT INTO app.MetricSnapshots (                              │
 │    CalculationDate, ApplicationId, PipelineRunId,               │
 │    DenominatorCount, NumeratorCount, MatchedCount,              │
 │    AdoptionPct, DenominatorRevenue, NumeratorRevenue,           │
 │    RevenuePct                                                   │
 │  )                                                              │
 │                                                                 │
 │  Step 6b: Update app.PipelineRuns status → 'Completed'          │
 └─────────────────────────────────────────────────────────────────┘
```

**Performance Optimisation Decisions (ADF):**

| Decision | Rationale |
|----------|----------|
| Stored Procedure activities over Data Flow | SP avoids data movement between ADF compute and SQL; all processing stays server-side. For volumes under 100K rows this outperforms Mapping Data Flows. |
| `OPENJSON` for JSON parsing | Native SQL Server JSON support; no external compute. Driven by `ApplicationModels.SourcePath`. |
| Parallel lookups in Step 1 | ADF parallel activity execution; no data dependency between lookups. |
| Sequential rule application via dynamic SQL | Mirrors notebook's sequential filter pattern; rules built from `DenominatorFilterRules` + `DenominatorModels.SourceColumn` mapping. Parameterised to prevent injection. |
| ForEach with batch=5 in Orchestrator | Process up to 5 apps concurrently; controls SQL concurrency. |
| Temp tables for intermediate results | Scoped to SP connection; no cross-pipeline state pollution. |
| Indexed local denominator view | Covering indexes on `stage.DenominatorSnapshot` / `app.vw_DenominatorLocal` for `EngagementID`, `ClientID`, `EngagementServiceCode`. External view never queried by SPs. |

**Processing Contract:**
- Metric recalculation runs **asynchronously** without blocking the user session.
- Invalid or unmatched IDs are surfaced to the user with clear error context — they never silently inflate or deflate adoption metrics.
- Raw source data is preserved in staging tables before any transformation.
- Pipeline run metadata (start, end, status, counts) is persisted in `app.PipelineRuns` for observability.

### 4.7 Concurrency Control for Rules Configuration

Rules configuration (denominator and numerator filter rules) supports concurrent editing by multiple users through a three-layer mechanism that prioritizes data consistency without blocking workflows.

#### 4.7.1 Optimistic Concurrency Control (OCC)

Each application's rules configuration maintains a monotonic version counter tracked in `app.ConfigVersions`:

| Column | Type | Description |
|--------|------|-------------|
| `ApplicationId` | UNIQUEIDENTIFIER | FK → `Applications` |
| `RuleScope` | NVARCHAR(32) | `'denominator'` or `'numerator'` |
| `Version` | INT | Monotonic counter, starts at 1 |
| `LastModifiedBy` | NVARCHAR(128) | User who last saved |
| `LastModifiedAt` | DATETIME2 | Timestamp of last save |

**Protocol:**
1. `GET /api/filters/:scope/:appId` returns the current `configVersion` in the response.
2. `PUT /api/filters/:scope/:appId` requires the client to include the version they loaded (via `configVersion` body field or `If-Match` header).
3. The stored procedure (or API transaction) performs: `UPDATE app.ConfigVersions SET Version = Version + 1 WHERE ApplicationId = @appId AND RuleScope = @scope AND Version = @clientVersion`. If `@@ROWCOUNT = 0`, a version mismatch occurred → return HTTP 409 with current state.
4. The version increment and rules persistence occur in a **single SQL transaction** — atomic and consistent.

**409 Conflict Response Schema:**
```json
{
  "error": "CONFLICT_VERSION_MISMATCH",
  "currentVersion": 6,
  "currentRules": [...],
  "lastModifiedBy": "user@example.com",
  "lastModifiedAt": "2026-06-12T14:30:00Z"
}
```

#### 4.7.2 Advisory Edit Sessions (Soft Locks)

When a user opens the rules configuration form in edit mode, the UI registers a lightweight edit session:

| Table: `app.ConfigEditSessions` | | |
|---|---|---|
| `SessionId` | UNIQUEIDENTIFIER | PK |
| `ApplicationId` | UNIQUEIDENTIFIER | FK → Applications |
| `RuleScope` | NVARCHAR(32) | `'denominator'` or `'numerator'` |
| `UserId` | NVARCHAR(128) | Who is editing |
| `SessionStart` | DATETIME2 | When editing began |
| `LastHeartbeat` | DATETIME2 | Last client heartbeat |
| `IsActive` | BIT | Active flag |

**Lifecycle:**
- **Register**: `POST /api/filters/:scope/:appId/edit-session` — creates session on form open (edit mode only, not read-only).
- **Heartbeat**: `PATCH /api/filters/:scope/:appId/edit-session` — client sends every 60 seconds to keep session alive.
- **Release**: `DELETE /api/filters/:scope/:appId/edit-session` — client sends on form close, navigation away, or browser `beforeunload`.
- **Auto-expiry**: Sessions with `LastHeartbeat` older than 5 minutes are considered stale and cleaned up.

**Notification to other users:**
- `GET /api/filters/:scope/:appId` includes `activeEditors[]` in the response when other users have active sessions.
- The UI displays a non-blocking advisory banner: "⚠️ [Display Name] is currently editing this configuration (started at HH:MM). Your changes may conflict."
- Banner auto-dismisses when the other user's session is released.

**Key properties:**
- Advisory locks **never block** saves — they are informational only.
- A `viewer` role never registers a session (read-only access).
- Sessions are scoped to `(ApplicationId, RuleScope)` — editing denominator rules for App A does not affect numerator rules for App A.

#### 4.7.3 Conflict Resolution UX

When a 409 Conflict is received after save:

```
┌──────────────────────────────────────────────────────────────┐
│  ⚠️  Configuration Conflict Detected                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  [User X] saved a new version of this configuration at      │
│  14:30 while you were editing.                              │
│                                                              │
│  ┌─────────────────────┐  ┌─────────────────────────────┐   │
│  │  YOUR CHANGES       │  │  LATEST SAVED (v6)          │   │
│  │                     │  │  by user.x@company.com      │   │
│  │  + Rule: ESC IN     │  │  + Rule: ESC IN             │   │
│  │    ('TAX','AUDIT')  │  │    ('TAX')                  │   │
│  │  - Rule: Revenue >0 │  │  (no change)                │   │
│  └─────────────────────┘  └─────────────────────────────┘   │
│                                                              │
│  ┌───────────────┐  ┌──────────────┐  ┌────────────────┐    │
│  │  Reload &     │  │  Force-save  │  │    Cancel      │    │
│  │  Re-edit      │  │  (admin)     │  │                │    │
│  └───────────────┘  └──────────────┘  └────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

**Resolution options:**
1. **Reload & Re-edit** — Discards local state, loads the latest version, user manually re-applies their intent.
2. **Force-save** (administrator only) — Persists the user's version as the new current, overriding the conflicting save. Audit-logged with override reason in `app.RuleChangeAudit`.
3. **Cancel** — Closes dialog, preserves unsaved form state for further editing or manual comparison.

#### 4.7.4 Graceful Degradation

If the edit session subsystem is unavailable (e.g., `ConfigEditSessions` table unreachable):
- The system degrades to **pure optimistic concurrency** — saves are still protected by version checks.
- Advisory banners become unavailable but data consistency is maintained.
- No user action is blocked.

---

### 4.8 Impact Preview (Option D — Staged Rules + Existing Pipeline SP Reuse)

The impact preview feature enables users to see the full effect of proposed denominator rule changes (adoption %, revenue share %, matched count, denominator count, denominator revenue) **before committing** them. The implementation reuses the entire existing pipeline with a single branching parameter — zero logic duplication.

#### 4.8.1 Architecture Decision: Option D

Four implementation options were evaluated (see `specs/012-impact-preview-dedup-concurrency/preview-options-comparison.md`):

| Option | Approach | Rejected Because |
|--------|----------|------------------|
| A | TypeScript query builder (full metrics in app layer) | Reimplements pipeline logic in TS (~400 lines); permanent drift risk; degrades at scale |
| B | Dedicated preview SP (`usp_PreviewDenominatorImpact`) | Reimplements entire pipeline in new SP (~500 lines T-SQL); violates "no SP testing" constraint |
| C | SP + pre-aggregated indexed views | All cons of B + indexed view complexity; worst effort-to-benefit ratio |
| **D** | **Staged rules table + existing pipeline SP reuse** | **Selected** — ~15 lines new SQL; zero logic duplication; guaranteed parity |

**Key differentiator**: Option D runs the **identical production pipeline code path** with an optional `@previewSessionId` parameter. Preview results are definitionally identical to what committing the rules and triggering a pipeline would produce.

#### 4.8.2 Staging Table

```sql
stage.DenominatorFilterRulesPreview (
    PreviewId          UNIQUEIDENTIFIER PK DEFAULT NEWID(),
    SessionId          UNIQUEIDENTIFIER NOT NULL,   -- scopes rules to one preview
    ApplicationId      UNIQUEIDENTIFIER NOT NULL,
    DenominatorModelId UNIQUEIDENTIFIER NOT NULL FK → app.DenominatorModels,
    Operator           NVARCHAR(32) NOT NULL,
    Value              NVARCHAR(512) NOT NULL,
    RuleOrder          INT NOT NULL,
    CreateDate         DATETIME2 DEFAULT SYSUTCDATETIME(),
    ExpiresAt          DATETIME2 DEFAULT DATEADD(HOUR, 1, SYSUTCDATETIME())
)
```

Indexes: `IX_DenomPreview_Session (SessionId, ApplicationId)`, `IX_DenomPreview_Expiry (ExpiresAt)`.

#### 4.8.3 SP Modifications

- **`usp_ExecutePipelineRun`** — add optional `@previewSessionId UNIQUEIDENTIFIER = NULL`; pass through to `usp_BuildFilteredDenominator`.
- **`usp_BuildFilteredDenominator`** — add optional `@previewSessionId UNIQUEIDENTIFIER = NULL`; when non-NULL, read rules from `stage.DenominatorFilterRulesPreview WHERE SessionId = @previewSessionId` instead of `app.DenominatorFilterRules`. All downstream SQL generation is unchanged.

Total new SQL: ~15 lines (one `IF/ELSE` branch + parameter pass-through).

#### 4.8.4 Execution Strategy — ADF Direct Call (MVP)

The preview reuses the existing `PipelineOrchestrationService` which supports two execution modes:

| Mode | When | Mechanism |
|------|------|-----------|
| **ADF** | Production / staging environments | `ADFPipelineClient` POSTs to ADF webhook; ADF runs SP on managed compute |
| **Local** | Development / test | `ValidationPipelineDbRepository.executeLocalPipeline()` calls SP directly |

For preview, the same service is invoked with `triggerSource: "Preview"` and `previewSessionId`. No new infrastructure required.

#### 4.8.5 Result Delivery — Server-Sent Events (SSE)

`POST /api/filters/denominator/:appId/preview` returns `Content-Type: text/event-stream`:

```
event: status
data: {"stage": "processing", "previewRunId": "..."}

event: complete
data: {"current": {...}, "projected": {...}, "delta": {...}, "warnings": [...]}
```

- **Local mode**: SSE connection held open while SP executes (3–8s); result streamed immediately on completion.
- **ADF mode**: Server-side polling inside SSE stream; client sees clean event flow.
- **No client-side polling logic** — entire preview lifecycle is a single HTTP transaction.

#### 4.8.6 Concurrency & Cleanup

- **No concurrency guard for preview**: Previews are session-isolated (`SessionId`) and non-destructive (`TriggerSource = 'Preview'`). Multiple concurrent previews for the same app operate independently.
- **Stale run recovery (production guard)**: Production pipeline concurrency guard auto-fails runs stuck > 30 minutes, preventing permanent blocking from SP timeouts or ADF crashes.
- **Staged rules TTL**: `ExpiresAt` column + SQL Agent job purges orphaned rows hourly.
- **Preview data retention**: Preview `PipelineRuns` and `MetricSnapshots` rows purged after 24h.

#### 4.8.7 Scale Path

| Phase | Execution | Result Delivery | Trigger |
|-------|-----------|-----------------|--------|
| **MVP** | ADF direct call / local fire-and-forget | SSE | 5 apps, < 20 users |
| **Growth** | Same ADF (retries handle volume) | Same SSE | 20–50 apps |
| **Scale** | Background worker (Azure Function + Queue) | Same SSE | 50+ concurrent previews; ADF contention |
| **Enterprise** | Worker + queue per region | SignalR (if proxy buffering issues) | 100+ concurrent, multi-region |

The client-facing SSE contract never changes — only the execution backend evolves.

---

## 5. Data Flow Detail

### 5.1 Denominator Flow

```
External Mercury SQL Server (independent server)
  [InventoryAnalysis].[dbo].[vw_USTaxBTS_FY26_MaxACD]
    │
    ▼  (ADF Copy Activity — weekly; ADF bridges connectivity)
Local ATTG_Usage Database
  stage.DenominatorSnapshot  (truncate + reload)
    │
    ▼  (SP: usp_RefreshDenominatorLocal — type coercion, dedup)
  app.vw_DenominatorLocal  (view over local snapshot)
    │
    ▼  (SP: usp_BuildFilteredDenominator per app rules)
  #FilteredDenom  (temp table — addressable population)
    │
    ▼
Addressable Population (per application)
```

> **Note**: The application database (ATTG_Usage) never queries the external Mercury server directly. ADF is the sole connectivity bridge.

### 5.2 Numerator Flow

```
Application Data (JSON via API)
    │
    ▼
POST /api/numerator  ──►  stage.EngagementUsageRaw
    │
    ▼  (Async processing)
Parse PayloadJson
    │
    ▼
Validate IDs against Denominator
    │
    ▼
Apply Numerator Filter Rules (per app config)
    │
    ▼
Validated Numerator Records
```

### 5.3 Metrics Calculation Flow

```
Denominator (after app-specific filters)     Numerator (after validation + filters)
           │                                             │
           └──────────────┬──────────────────────────────┘
                          │
                          ▼
                  MATCH by Key (Engagement ID or Client ID)
                          │
                          ▼
              ┌────────────────────────────────────┐
              │ Adoption % = Matched / Denominator │
              │ Revenue % = Matched Rev / Denom Rev│
              └────────────────────────────────────┘
                          │
                          ▼
                  MetricSnapshots Table
```

---

## 6. Validation Rules

### 6.1 Numerator Validation

| Rule | Description |
|------|-------------|
| ID existence | Engagement/Client ID must exist in current Denominator |
| Duplicate rejection | Duplicate ID entries within the same upload are rejected |
| Data type coercion | Numeric fields parsed with `errors='coerce'` semantics |
| Status values | Navigate: {Navigate, Non-Navigate, Inactive, Not Classified}; EYST: {Yes, No} |

### 6.2 Denominator Filters (Application-Specific, from Notebook Analysis)

The following rules are derived from the actual Jupyter notebook analysis (`StakeholderDocuments/notebooks/`).

#### Maestro (01_maestro_analysis.ipynb)

| Rule # | Filter | Operator | Value | DenominatorModel Field |
|--------|--------|----------|-------|------------------------|
| 1 | Engagement Service Code | EQ | `11420` | EngagementServiceCode |
| 2 | Release Date | GT | `2025-01-01` | ReleaseDate |
| 3 | Engagement Name Exclusion | NOT_CONTAINS | `pof\|perseus\|pt\|ITR\|BTA\|Bison` | Engagement |
| 4 | ANSR / Tech Revenue ETD | NEQ | `0` | ETD_ANSRAmt |
| 5 | Engagement Status | IN | `Closing,Completed,Pre-Closing,Released` | EngagementStatus |

**Metrics**: Engagement-level. Revenue column: `ETD_ANSRAmt`. Match key: `EngagementID`.

#### EYST (02_eyst.ipynb)

| Rule # | Filter | Operator | Value | DenominatorModel Field |
|--------|--------|----------|-------|------------------------|
| 1 | Engagement Service Code | IN | `10459,11420,10170,10466` | EngagementServiceCode |
| 2 | Engagement Name Inclusion | CONTAINS | `FTTS` | Engagement |
| 3 | Engagement Status | NOT_IN | `Cancelled` | EngagementStatus |

**Metrics**: Client-level (`Client ID`). Revenue column: `ETD_ANSRAmt`. Match key: `ClientID`. Numerator `EYSTActive` flag drives classification.

**Note**: EYST notebook joins ShareTrust data on `Client ID` to bring in `EYST Active Client` flag. In the ADF pipeline, this classification comes from the numerator JSON payload (`$.eystActive`) — not from a Mercury column.

#### Prodigy (03_prodigy.ipynb)

| Rule # | Filter | Operator | Value | DenominatorModel Field |
|--------|--------|----------|-------|------------------------|
| 1 | Engagement Service Code | EQ | `10676` | EngagementServiceCode |
| 2 | Release Date | GT | `2024-01-01` | ReleaseDate |
| 3 | ANSR / Tech Revenue ETD | NEQ | `0` | ETD_ANSRAmt |

**Metrics**: Client-level (`Client ID`). Revenue column: `FYTD_ANSRAmt`. Match key: `ClientID`. Notebook matches on `Client ID` (not Engagement ID).

#### Vector (04_vector_analysis.ipynb)

| Rule # | Filter | Operator | Value | DenominatorModel Field |
|--------|--------|----------|-------|------------------------|
| 1 | Engagement Service Code | IN | `10675,10677` | EngagementServiceCode |
| 2 | Account Channel | EQ | `2` | AccountChannel |
| 3 | ANSR / Tech Revenue ETD | GT | `10000` | ETD_ANSRAmt |
| 4 | Release Date | GT | `2024-01-01` | ReleaseDate |
| 5 | Engagement Status | IN | `Closing,Completed,Pre-Closing,Released` | EngagementStatus |

**Metrics**: Engagement-level. Revenue column: `ETD_ANSRAmt`. Match key: `EngagementID`. Notebook enriches Vector data with Mercury revenue columns.

#### Navigate (05_navigate_analysis.ipynb)

| Rule # | Filter | Operator | Value | DenominatorModel Field |
|--------|--------|----------|-------|------------------------|
| 1 | Engagement Service Code | EQ | `10469` | EngagementServiceCode |

**Metrics**: Engagement-level. Revenue column: `FYTD_ANSRAmt`. Match key: `EngagementID`. Navigate classification (Navigate/Non-Navigate/Inactive/Not Classified) comes from the numerator payload's `NavigateStatus` field.

#### Summary: Filter Types Used

| Filter Type | Operator Examples | Used By |
|-------------|-------------------|----------|
| Service Code | `EQ`, `IN` | All |
| Release Date | `GT` (after date) | Maestro, Prodigy, Vector |
| Engagement Status | `IN`, `NOT_IN` | Maestro, EYST, Vector |
| Minimum Revenue | `NEQ 0`, `GT` (threshold) | Maestro, Prodigy, Vector |
| Name Exclusion | `NOT_CONTAINS` (pattern) | Maestro |
| Name Inclusion | `CONTAINS` (pattern) | EYST |
| Account Channel | `EQ` | Vector |

---

## 7. Security

| Layer | Control |
|-------|---------|
| **Authentication** | Azure AD SSO (Extended-MVP and beyond). Anonymous access prohibited. |
| **Token Transport** | Bearer token via `Authorization` header; stored in client `sessionStorage`. Cookies are NOT used for API auth (WAF incompatibility — see S7.1). |
| **Authorization** | Three roles: `administrator`, `application_owner`, `viewer`. Exactly one role per user. |
| **API Protection** | All endpoints check auth; 401/403 on failure; no internal detail leakage. |
| **Input Sanitization** | External inputs sanitized against SQL injection and XSS. |
| **Audit** | All tables carry audit columns. Filter rule changes audit-logged with user, previous value, timestamp. |
| **Data Privacy** | Role-based data scoping: owners/viewers see only assigned applications. |

### 7.1 Authentication Flow — Bearer Token with sessionStorage

The application uses a **Bearer token + sessionStorage** pattern instead of traditional auth cookies. This design decision was driven by WAF (Web Application Firewall) compatibility constraints.

#### Problem: WAF Cookie Interference

Azure Front Door / third-party WAF appliances in the corporate network inspect, strip, or rewrite `Set-Cookie` headers for security policy enforcement. This causes:

1. Large JWT-based auth cookies (Auth.js/NextAuth) to be silently stripped or truncated by the WAF.
2. `SameSite`, `Secure`, and `Domain` cookie attributes to be rewritten, breaking cross-origin flows.
3. Intermittent auth failures where the cookie is present in the browser but not forwarded through the WAF proxy.

#### Solution: Token in Authorization Header

```
┌──────────┐       ┌────────────────┐       ┌──────────────────┐
│  Browser │──1──▶│ Azure AD Login  │──2──▶│ /api/auth/callback│
│          │       │ (OAuth2 PKCE)  │       │ (sets auth code)  │
└──────────┘       └────────────────┘       └──────────────────┘
     │                                              │
     │◀───────────── redirect ──────────────────────┘
     │
     ├──3──▶ POST /api/auth/exchange  (sends auth code)
     │       ◀────── { token: "Bearer <AES-256-GCM encrypted>" }
     │
     ├──4──  sessionStorage.setItem("attg_session_token", token)
     │
     ├──5──▶ GET /api/filters/denominator/:appId
     │       Authorization: Bearer <token>
     │       (WAF passes standard Authorization headers unmodified)
     └─────
```

**Steps**:

1. User authenticates with Azure AD via OAuth2 PKCE flow.
2. Azure AD redirects to `/api/auth/callback` with an authorization code. The server stores a short-lived auth code in an in-memory store.
3. Client calls `POST /api/auth/exchange` with the auth code to receive an encrypted session token.
4. Client stores the token in `sessionStorage` (tab-scoped; cleared on tab close).
5. All subsequent API requests include `Authorization: Bearer <token>`. WAF appliances pass standard `Authorization` headers without modification.

#### Why sessionStorage (not localStorage)

| Concern | sessionStorage | localStorage |
|---------|---------------|--------------|
| Tab isolation | ✅ Per-tab scope | ❌ Shared across tabs |
| XSS exposure window | Cleared on tab close | Persists indefinitely |
| Multi-tab UX | Each tab independently authenticated | Single token shared |

#### Token Structure

- **Encryption**: AES-256-GCM (payload encrypted, not just signed)
- **Integrity**: HMAC-SHA256 over ciphertext
- **Payload**: `{ userId, role, isActive, applications[], oid, email }` — not readable from `sessionStorage` or network inspection
- **TTL**: Configurable via `SESSION_TOKEN_TTL_SECONDS` (default: 8 hours)
- **Rotation**: Supports zero-downtime secret rotation via `SESSION_TOKEN_SECRET_PREVIOUS` env var

#### Session Resolution Priority

The server resolves identity in this order (first match wins):

1. **Bearer token** from `Authorization` header (`resolveFromBearerToken`) — primary, WAF-safe
2. **Auth.js cookie session** (`resolveFromAuthSession`) — fallback for legacy/dev flows
3. **Lightweight session ID cookie** (`attg_sid`, ~80 bytes HMAC-signed) — server-component page renders only

#### Key Source Files

| File | Purpose |
|------|---------|
| `src/frontend/lib/auth/bearer-token.ts` | Extracts & verifies Bearer token from Authorization header |
| `src/frontend/lib/auth/session-token.ts` | AES-256-GCM token encrypt/decrypt with secret rotation |
| `src/frontend/lib/auth/session.ts` | Multi-strategy session resolution (Bearer → Cookie → SID) |
| `src/frontend/lib/auth/auth-code-store.ts` | Short-lived auth code store for exchange flow |
| `src/frontend/lib/auth/useSession.ts` | Client React hook; reads token from `sessionStorage` |

#### API Contract Implications

- All API contracts specify `Authorization: Bearer <token>` — never `Cookie`.
- Clients MUST NOT send auth tokens via cookies, query strings, or custom headers.
- Server returns `401 Unauthorized` if the Authorization header is missing or the token is invalid/expired.

---

## 8. Scalability & Performance

| Requirement | Approach |
|-------------|----------|
| Dashboard render < 3 s | Pre-calculated metrics; indexed SQL queries; server-side rendering |
| Async metric recalculation | ADF pipeline runs asynchronously after numerator ingestion |
| Weekly denominator refresh | ADF scheduled pipeline leveraging Azure SQL bulk load |
| Five applications initially | Configuration-driven design supports onboarding new applications without code changes |

---

## 9. Observability

| Aspect | Implementation |
|--------|----------------|
| **Pipeline Monitoring** | ADF monitoring with run status, duration, and ETL success-rate tracking toward 99% daily target |
| **API Logging** | Structured logging on all API endpoints (request, response status, auth principal) |
| **Validation Reporting** | Validation results persisted per ingestion event; surfaced in UI |
| **Metric Audit Trail** | `MetricSnapshots` provides full history of every calculation run |
| **Freshness Monitoring** | Data-freshness timestamp and last successful pipeline run id are surfaced in API/UI payloads |
| **Alerting** | Deployment and pipeline failure alerts are emitted with rollback/runbook context |
| **Error Surfacing** | Basic error handling: "Failed to load data" on frontend failures (MVP) |

---

## 10. Phased Delivery Alignment

| Phase | Architectural Scope |
|-------|---------------------|
| **Pre-MVP: CI Baseline** | Baseline CI workflow (`.github/workflows/ci.yml`) merged to trunk; branch protection rules enforced. Unblocks all source-code work. |
| **Pre-MVP: Infrastructure** | Terraform configurations (`infra/terraform/`) provisioning all Azure resources for dev and prod environments; remote state backend configured. |
| **MVP** | Database schema + seed data; User Administration API/UI; Numerator intake endpoint + staging; Numerator filter configuration UI; Basic error handling |
| **Extended-MVP A (EPIC-BQM-007)** | Azure AD SSO; Numerator validation pipeline completion; adoption/revenue/On Target Rate/Average Engagement calculation and snapshot persistence; interim investment dummy dataset in SQL |
| **Extended-MVP B (EPIC-BQM-014)** | Dashboard UI composition, KPI rendering, role-scoped visibility, Sub Service Line grouping, and accessibility/responsive baseline |
| **Phase 2** | Denominator rules configuration UI; Preview impact before save; Audit-log for rule changes |
| **Phase 3 (EPIC-BQM-015)** | Date and period controls, historical KPI trend views, and benchmark alerting for governed dashboard insights |
| **Phase 4 (EPIC-BQM-016)** | Optional AI assistant for denominator-rule/adoption-setting recommendations and role-scoped dashboard narrative analysis |
| **Post-MVP: CD Pipeline** | Automated deployment workflow (`.github/workflows/cd.yml`) to Azure App Service for staging and production; activated only after full MVP is complete and validated. |

---

## 10.1 Epic Redefinition and Additions (Planning Baseline)

The following backlog updates are planning updates only and do not change delivered behavior in implemented epics.

| Epic | Status | Intent |
|------|--------|--------|
| EPIC-BQM-007 | Redefined in progress | Complete adoption/revenue/On Target/Average Engagement KPI calculation, snapshot persistence, and interim investment dummy dataset in SQL |
| EPIC-BQM-014 | New planned | Deliver dashboard UI, grouping by Sub Service Line, and accessibility/responsive baseline |
| EPIC-BQM-011 | Redefined planned | Establish IaC foundation, environment governance, and diagnostics baseline |
| EPIC-BQM-012 | Redefined planned | Establish controlled CD governance, release alerting, and rollback sequencing |
| EPIC-BQM-013 | New planned | Onboard investment source, reconciliation controls, and financial revision/backfill governance |
| EPIC-BQM-015 | New planned | Deliver advanced dashboard date controls, trend analysis, and benchmark alerts |
| EPIC-BQM-016 | New planned | Deliver optional AI assistance for denominator configuration and dashboard analysis |

---

## 11. References

| Document | Path |
|----------|------|
| PRD — Application Goals | `StakeholderDocuments/ApplicationGoals.md` |
| PRD — Application Features | `StakeholderDocuments/ApplicationFeatures.md` |
| PRD — Solution Architecture | `StakeholderDocuments/AUTOMATED_SOLUTION_ARCHITECTURE.md` |
| PRD — Business Rules & ETL | `StakeholderDocuments/BUSINESS_RULES_AND_ETL_SUMMARY.md` |
| Constitution | `.specify/memory/constitution.md` |
| CI Pipeline Epic | `Documentation/Backlog/epics/epic-010-ci-pipeline.md` |
| Dashboard UI Grouping Epic | `Documentation/Backlog/epics/epic-014-dashboard-ui-grouping.md` |
| Azure IaC/Terraform Epic | `Documentation/Backlog/epics/epic-011-azure-infrastructure-iac.md` |
| CD Pipeline Epic | `Documentation/Backlog/epics/epic-012-cd-pipeline.md` |
| Investment Data Onboarding Epic | `Documentation/Backlog/epics/epic-013-investment-data-onboarding-reconciliation.md` |
| Advanced Dashboard Time Controls Epic | `Documentation/Backlog/epics/epic-015-advanced-dashboard-time-controls.md` |
| AI-Assisted Rules and Insights Epic | `Documentation/Backlog/epics/epic-016-ai-assisted-rules-and-dashboard-insights.md` |
