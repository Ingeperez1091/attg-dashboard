# Application Features

## [1] Implemented Features

### [1.1] Database Foundation

1. Azure SQL schemas established: `app` (governed application data) and `stage` (raw ingestion).
2. Audit conventions applied to all governed tables: `CreateDate`, `CreatedBy`, `UpdateDate`, `UpdatedBy`.
3. Seed data applied for applications, roles, and super-admin user.
4. Database migrations applied in deployment order (001–005).

### [1.2] Authentication and Authorization

1. Users authenticate through Azure AD SSO.
2. Three roles are defined: `administrator`, `application_owner`, `viewer`.
3. Administrators can access all applications and all functionality.
4. Application owners and viewers can only access applications assigned to them via `UserApplications`.
5. Application owners can edit filter configuration for their assigned applications.
6. Viewers have read-only access.
7. Authorization is enforced server-side on all API routes.

### [1.3] User Administration

1. User Administration tab is visible and accessible only to `administrator` users.
2. Non-administrator users cannot access User Administration, including by direct URL navigation.
3. Administrators can create users with core identity properties: identity key, email, display name, and active state.
4. Soft-delete is supported (mark user inactive); hard delete is not permitted.
5. Exactly one role is assigned per user at any time.
6. Allowed role values: `administrator`, `application_owner`, `viewer`.
7. Administrators can assign users to one or many applications.
8. An "All Applications" shortcut is available to grant access to all applications at once.
9. Duplicate per-user application assignments are prevented.
10. Role and assignment updates take effect for subsequent authorization checks.

### [1.4] Numerator Ingestion

1. `POST /api/numerator` receives numerator usage payloads and stores them in `stage.EngagementUsageRaw`.
2. Ingestion accepts structured JSON with engagement, client, actor, and application identifiers.
3. Row-level audit fields are applied on insert.

### [1.5] Filter Configuration

1. Numerator filter rules are configurable per application via `GET|PUT /api/filters/numerator/:appId`.
   - Rules stored in `app.NumeratorFilterRules`.
2. Denominator filter rules are configurable per application via `GET|PUT /api/filters/denominator/:appId`.
   - Rules stored in `app.DenominatorFilterRules` and `app.AdoptionSettings`.
   - Additional endpoints available: `/api/filters/denominator/:appId/audit`, `/preview`, `/settings`.
3. Only users with appropriate role and application assignment may configure filters.

### [1.6] Validation and Processing Pipeline

1. Pipeline execution is triggered via `POST /api/pipeline/run`.
2. Pipeline run state is tracked in `app.PipelineRuns` and retrievable via `GET /api/pipeline/:runId`.
3. Numerator records are validated against configured rules; results are stored in `app.ValidationResults`.
4. Matched records are persisted to `app.MatchedRecords`.
5. Validation results are exposed via:
   - `GET /api/pipeline/validation-results/:appId` — full result list per application.
   - `GET /api/pipeline/validation-results/:appId/summary` — aggregated summary.

### [1.7] Denominator Rules Configuration

1. Denominator snapshot is managed and versioned per application.
2. Preview and audit controls are available before rule activation.
3. Settings endpoint supports configuring the denominator basis per application.

## [2] In-Progress Features

### [2.1] Metrics Calculation and Dashboard Display

1. Metric calculation will compute adoption and revenue metrics from `app.MatchedRecords`.
2. Results will be persisted to `app.MetricSnapshots` with full pipeline run lineage.
3. `GET /api/metrics/:appId` will serve metric data to the dashboard.
4. Dashboard will display:
   - KPI cards: Adoption Percentage, Revenue Percentage, On Target Rate.
   - Application-level metric rows with status chips (On Target / Below Target).
5. Metrics are scoped to the user's assigned applications and role.

## [3] Planned Features

### [3.1] Portfolio Overview Dashboard

1. Hero summary area with context narrative and data freshness timestamp.
2. Global KPI cards: Investment, Revenue, Average Engagement, On Target Rate.
3. Last successful pipeline run identifier displayed.

### [3.2] Hierarchical Data Exploration

1. Filter by Sub Service Line using pill-tab selector.
2. Drill from portfolio level to category level to product level.

### [3.3] Product Performance Visibility

1. Product-level investment and revenue display.
2. Engagement and revenue-share progress bars.
3. On Target and Below Target status chips per product.
4. ETD and FYTD basis visible for revenue-oriented metrics.

### [3.4] Reporting Governance and Trust

1. Data freshness indicators and metric definition version shown on dashboard.
2. Audit-ready lineage from source payload to dashboard output.
3. Reconciliation-ready ETL controls for quality assurance.
4. Metric metadata available to users: definition version, refresh timestamp, source batch id, data quality flags.

### [3.5] Investment Integration

1. Investment source data onboarding and ingestion pipeline.
2. ROI proxy and investment variance KPI views.
3. Investment amount, currency, fiscal period, and source system fields.

### [3.6] AI-Assisted Rules and Insights

1. Optional AI assistant can draft denominator filter rules from application context and historical rule patterns.
2. Optional AI assistant can suggest denominator adoption settings (adoption level and revenue basis) with explanation.
3. AI suggestions remain non-authoritative until user review and explicit save.
4. Optional AI dashboard analysis can generate narrative summaries of KPI patterns, anomalies, and below-target drivers.
5. AI-generated analysis is role-scoped and only uses authorized dashboard data.

## [4] General Design and Quality Standards

1. Motif web components and style guide are integrated as the UI foundation.
2. Basic error handling: clear failure messaging displayed to users when API calls fail.
3. Accessible navigation: keyboard-navigable filters, semantic labels for charts, reduced-motion support.
4. Responsive dashboard with defined empty-state behavior for no-data conditions.
5. All governed tables include `CreateDate`, `CreatedBy`, `UpdateDate`, `UpdatedBy` audit fields.
6. Parameterized SQL is used on all write paths; string-concatenated queries are not permitted.
