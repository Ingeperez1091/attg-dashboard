# BTS Quarterly Metrics Dashboard — Assumptions

> **Version**: 1.0.0  
> **Status**: Draft  
> **PRD Sources**: All `Documentation/StakeholderDocuments/*.md`  
> **Constitution**: `.specify/memory/constitution.md` v1.0.0  
> **Changelog**: v1.0.0 — Added A25 (External Denominator Database); updated A1 and A12 to reflect that the Mercury view resides on an external server and processing uses a local materialized copy. v1.2.0 — Added A18–A24 from notebook ETL analysis and ADF pipeline design. v1.1.0 — Added A12 (Shared Denominator Model), A13 (Denominator Filter Rules AND-Combined). v1.3.0 — Added A26–A31 from stakeholder goal and feature alignment review. v1.4.0 — Added A32–A34 for optional AI-assisted configuration and dashboard-analysis governance. v1.5.0 — Added A35 (Composite-Key Deduplication), A36 (Preview operates on local snapshot only), A37 (Optimistic Concurrency for Rules Config) for EPIC-BQM-017.

---

## Assumptions

### A1 — Denominator Data Source

**Assumption**: The Mercury engagement list is available as a weekly export that can be loaded into the local ATTG_Usage database via Azure Data Factory. The canonical view `[InventoryAnalysis].[dbo].[vw_USTaxBTS_FY26_MaxACD]` resides on an **external, Mercury-managed SQL Server** that may not be accessible from ATTG_Usage via linked-server or cross-database queries. ADF bridges this connectivity gap by copying the data into a local `stage.DenominatorSnapshot` table. The report format (6 header rows if Excel, known column names) remains stable.

**Impact if wrong**: If the external server becomes inaccessible to ADF as well, an alternative export mechanism (e.g., manual flat-file drop to Azure Blob) would be needed. If the format changes, the ADF pipeline column mappings and `usp_RefreshDenominatorLocal` SP would need adaptation.

**Source**: `Documentation/StakeholderDocuments/BUSINESS_RULES_AND_ETL_SUMMARY.md` — Common Data Pipeline section; stakeholder confirmation that the view is on a separate server.

---

### A2 — Azure SQL as Single Database

**Assumption**: A single Azure SQL instance is sufficient for staging, configuration, and metric storage. No separate data warehouse or Data Lake is required for MVP through Phase 2.

**Impact if wrong**: Schema may need migration to Synapse or a data lakehouse if data volumes exceed Azure SQL limits.

**Source**: `Documentation/StakeholderDocuments/ApplicationGoals.md` — "Azure SQL-backed database project."

---

### A3 — Five Applications Fixed for MVP

**Assumption**: The five applications in scope (Maestro, EYST, Prodigy, Vector, Navigate) are fixed. No additional applications will be onboarded during MVP through Phase 2.

**Impact if wrong**: The configuration-driven design supports new applications without code changes, but seed data scripts and test coverage would need updates.

**Source**: `Documentation/StakeholderDocuments/AUTOMATED_SOLUTION_ARCHITECTURE.md` — Applications in Scope table.

---

### A4 — Numerator Data as JSON via API

**Assumption**: All numerator data (both manual and automated) will be ingested via the `POST /api/numerator` JSON endpoint. No direct file upload (e.g., Excel upload to a blob) is required for MVP.

**Impact if wrong**: A file upload mechanism and parser would need to be added.

**Source**: `Documentation/StakeholderDocuments/AUTOMATED_SOLUTION_ARCHITECTURE.md` — API Ingest Approach.

---

### A5 — Maestro and Prodigy APIs Available for Phase 3

**Assumption**: Maestro and Prodigy expose stable APIs that provide engagement/client utilization data. API credentials and documentation will be available before Phase 3 development begins.

**Impact if wrong**: Phase 3 connectors cannot be built. Manual upload would remain the only ingestion method for these applications.

**Source**: `Documentation/StakeholderDocuments/AUTOMATED_SOLUTION_ARCHITECTURE.md` — Auto-Generated sources; `Documentation/StakeholderDocuments/ApplicationGoals.md` — Phase 3.

---

### A6 — Azure AD Tenant Configured

**Assumption**: An Azure AD tenant with app registration capabilities is available. Users in the tenant correspond to dashboard users. Configuration (client ID, redirect URIs) will be provided before Extended-MVP development.

**Impact if wrong**: Authentication feature (EPIC-BQM-005) is blocked until Azure AD is provisioned.

**Source**: `Documentation/StakeholderDocuments/ApplicationFeatures.md` — "Users authenticate through Azure AD."

---

### A7 — Three Roles Sufficient

**Assumption**: The three roles (`administrator`, `application_owner`, `viewer`) are sufficient for all access control scenarios. No additional roles (e.g., `data_engineer`, `auditor`) are needed.

**Impact if wrong**: Additional roles would require schema changes to `dbo.Roles` and authorization middleware updates.

**Source**: `Documentation/StakeholderDocuments/ApplicationFeatures.md` — "Define 3 main roles"; Constitution Principle V.

---

### A8 — Single Match Key per Application

**Assumption**: Each application uses exactly one match key type (Engagement ID or Client ID), not both. This is determined at application registration and does not change dynamically.

**Impact if wrong**: The matching logic would need to support dual-key matching, adding complexity to the pipeline.

**Source**: `Documentation/StakeholderDocuments/AUTOMATED_SOLUTION_ARCHITECTURE.md` — Applications in Scope table (Match Key column).

---

### A9 — Numerator Filter Rules Are AND-Combined

**Assumption**: When multiple numerator filter rules are defined for an application, they are combined with AND logic (all must pass). OR-combination or complex boolean groupings are not required.

**Impact if wrong**: A rule-expression engine with grouping support would be needed.

**Source**: `Documentation/StakeholderDocuments/AUTOMATED_SOLUTION_ARCHITECTURE.md` — Filter rule UI mockup shows a simple list of conditions.

---

### A10 — Azure Data Factory for Orchestration

**Assumption**: Azure Data Factory is the orchestration tool for all data processing pipelines (denominator load, numerator processing, metric calculation). No alternative orchestration (e.g., Azure Functions, Databricks) is required.

**Impact if wrong**: Pipeline definitions in the `pipelines/` folder would need to target a different orchestration framework.

**Source**: `Documentation/StakeholderDocuments/ApplicationGoals.md` — "Orchestration, validation, and transformation with Azure Data Factory."

---

### A11 — Historical Data Not Required for MVP

**Assumption**: Historical data migration (past quarterly metrics from Jupyter notebooks) is not required. The system starts fresh and builds history from the first pipeline run.

**Impact if wrong**: A data migration effort would be needed to import historical metric snapshots.

**Source**: Inferred from PRD — no mention of historical data migration requirement.

---

### A12 — Shared Denominator Model (No Per-App Duplication)

**Assumption**: The Mercury denominator view (`vw_USTaxBTS_FY26_MaxACD`) has a single, fixed schema shared by all five applications. The view resides on an external server (see A25), so the system operates on a local materialized copy (`stage.DenominatorSnapshot` / `app.vw_DenominatorLocal`). `DenominatorModels` defines the view columns once (shared rows, no `ApplicationId`). Per-application variation is expressed only in `DenominatorFilterRules`, not in the model definition.

**Impact if wrong**: If different applications need to interpret or alias Mercury columns differently, `DenominatorModels` would need an `ApplicationId` column and per-app row duplication (~17 × 5 = 85 rows instead of 17). If the external view schema changes, the local snapshot table and `DenominatorModels` seed data must be updated.

**Source**: `Documentation/StakeholderDocuments/AUTOMATED_SOLUTION_ARCHITECTURE.md` — all five applications reference the same Mercury view columns; `Documentation/ProjectSpecifications/architecture.md` v1.3.0 — Denominator Model Metadata section, External View & Local Snapshot section.

---

### A13 — Denominator Filter Rules Are AND-Combined

**Assumption**: When multiple denominator filter rules are defined for an application, they are combined with AND logic (all must pass), consistent with numerator filter rules (A9). No OR-combination or grouping is required.

**Impact if wrong**: The ADF pipeline and preview API would need a rule-expression engine with boolean grouping support.

**Source**: Consistent with A9 and `Documentation/StakeholderDocuments/AUTOMATED_SOLUTION_ARCHITECTURE.md` — filter rule UI mockup shows a flat condition list.

---

### A14 — Motif Web Components Available

**Assumption**: The Motif Web Components library is available and compatible with Next.js/TypeScript. No custom design system needs to be built.

**Impact if wrong**: UI development would require a substitute component library or custom components.

**Source**: `Documentation/StakeholderDocuments/ApplicationFeatures.md` — "Motif style guide and web components are integrated as UI foundation."

---

### A15 — Metadata-Driven Application Models

**Assumption**: Each application's numerator payload structure is defined via the `app.ApplicationModels` metadata table (FieldName, FieldType, SourcePath, IsFiltirable, IsMetricDimension). ADF reads these definitions at runtime to parse JSON, apply filters, and calculate metrics — no per-application pipeline code is required.

**Impact if wrong**: Without metadata-driven models, each application would need a dedicated parsing/filtering pipeline, and filter UI fields would need to be hardcoded per application.

**Source**: `Documentation/StakeholderDocuments/AUTOMATED_SOLUTION_ARCHITECTURE.md` — Metadata-based architecture section; "application_model" table proposal.

---

### A16 — Numerator Filter Rules Reference Application Model Fields

**Assumption**: `NumeratorFilterRules` reference fields declared in `ApplicationModels` (via `ApplicationModelId` FK), not arbitrary user-entered field names. The filter configuration UI presents only fields marked `IsFiltirable = 1` in the application model.

**Impact if wrong**: Without referential integrity between filter rules and model fields, filters could reference nonexistent fields, causing pipeline failures or silent data loss.

**Source**: `Documentation/StakeholderDocuments/AUTOMATED_SOLUTION_ARCHITECTURE.md` — "👉 The solution is to decouple the model and filters from the pipeline"; Numerator filter UI mockup.

---

### A17 — Per-Application Payload Templates Are Known and Stable

**Assumption**: The field structures for each application's numerator JSON payload (Navigate, EYST, Prodigy, Maestro, Vector) are as documented in the PRD and will remain stable through MVP and Extended-MVP. Changes are handled by updating `ApplicationModels` metadata, not code.

**Impact if wrong**: Frequent payload structure changes would require application model updates and potentially filter rule migrations. The metadata-driven design accommodates this, but testing coverage would need to keep pace.

**Source**: `Documentation/StakeholderDocuments/AUTOMATED_SOLUTION_ARCHITECTURE.md` — Payload Template sections (Navigate, EYST, Prodigy).

---

### A18 — Stored Procedures Over ADF Data Flows for Processing

**Assumption**: All data validation, filtering, matching, and metric calculation logic runs inside Azure SQL stored procedures invoked by ADF Stored Procedure activities — not via ADF Mapping Data Flows or external compute. This is the preferred performance option for the expected data volumes (< 100K rows per application).

**Impact if wrong**: If data volumes exceed Azure SQL capacity or processing windows, the pipeline may need to migrate to ADF Mapping Data Flows with Spark compute or Azure Databricks.

**Source**: `Documentation/StakeholderDocuments/notebooks/*` — all five notebooks process data in-memory with pandas on datasets ranging from hundreds to ~10K rows; SQL Server can handle these volumes natively. `Documentation/ProjectSpecifications/architecture.md` v1.2.0 — Section 4.4 ADF Performance Optimisation.

---

### A19 — OPENJSON for Numerator Payload Parsing

**Assumption**: Azure SQL's built-in `OPENJSON` + `ApplicationModels.SourcePath` is sufficient for parsing numerator JSON payloads. No external JSON parsing service is needed.

**Impact if wrong**: If payloads contain deeply nested or array structures beyond simple `$.fieldName` paths, a custom parsing function would be needed.

**Source**: `Documentation/StakeholderDocuments/AUTOMATED_SOLUTION_ARCHITECTURE.md` — Per-Application Payload Templates; `Documentation/ProjectSpecifications/architecture.md` v1.2.0 — Step 3 OPENJSON.

---

### A20 — Revenue Column Varies Per Application

**Assumption**: Different applications use different revenue columns for their adoption revenue metric, as observed in the notebooks: Maestro and EYST use `ETD_ANSRAmt`, Prodigy and Navigate use `FYTD_ANSRAmt`, Vector uses `ETD_ANSRAmt` with a $10,000 minimum threshold. This is configured via `AdoptionSettings.RevenueMetric`.

**Impact if wrong**: If a single revenue column were assumed, adoption revenue percentages would be incorrect for applications using a different metric.

**Source**: `Documentation/StakeholderDocuments/notebooks/01_maestro_analysis.ipynb` (`ANSR / Tech Revenue ETD`), `03_prodigy.ipynb` (`ANSR / Tech Revenue FYTD`), `05_navigate_analysis.ipynb` (`ANSR / Tech Revenue FYTD`).

---

### A21 — Mercury Report Format Stable (6 Header Rows)

**Assumption**: The Mercury engagement list Excel report has 6 header rows (skipped during load) followed by data rows with the documented column names. This format is consistent across weekly refreshes.

**Impact if wrong**: The denominator load pipeline (`PL_DenomLoad_Weekly`) would need a format-detection or header-skip parameter.

**Source**: `Documentation/StakeholderDocuments/notebooks/00_header_data_loading.ipynb` — `pd.read_excel(skiprows=6)`; `Documentation/StakeholderDocuments/BUSINESS_RULES_AND_ETL_SUMMARY.md` — Common Data Pipeline section.

---

### A22 — Pipeline Processes One Application Per Execution

**Assumption**: The `PL_MetricsProcessing` pipeline is parameterised on `ApplicationId` and processes one application per invocation. The `PL_MetricsOrchestrator` pipeline loops over active applications with configurable concurrency (default batch = 5).

**Impact if wrong**: A single-invocation approach processing all 5 apps would be simpler to trigger but harder to debug, retry, and monitor individually.

**Source**: Inferred from architecture design. Notebook analysis shows each app has independent filter rules and match logic.

---

### A23 — Numerator Classification Comes from JSON Payload

**Assumption**: Application-specific classification fields (Maestro `InMaestro`, EYST `EYSTActive`, Navigate `NavigateStatus`, Vector `VectorEngagement`, Prodigy `InProdigy`) are provided in the numerator JSON payload. The pipeline does not need to re-derive classifications from external sources (e.g., reading ShareTrust or multi-tab Excel). The JSON API ingestion normalises these before staging.

**Impact if wrong**: If classifications are not in the JSON, the pipeline would need external data source connectors (ShareTrust, Navigate workbook tabs) — significantly increasing complexity.

**Source**: `Documentation/StakeholderDocuments/AUTOMATED_SOLUTION_ARCHITECTURE.md` — API Ingest Approach; `Documentation/ProjectSpecifications/architecture.md` — Per-Application Payload Templates.

---

### A24 — Denominator Rules from Notebooks Are Seed Defaults

**Assumption**: The denominator filter rules documented in the notebooks (Maestro: 5 rules, EYST: 3, Prodigy: 3, Vector: 5, Navigate: 1) are used as seed data for `DenominatorFilterRules`. Application owners can modify them through the denominator configuration UI (EPIC-BQM-008). The pipeline always reads from the database, not from hardcoded rules.

**Impact if wrong**: If rules are hardcoded, changes would require code deployments rather than UI configuration.

**Source**: `Documentation/StakeholderDocuments/notebooks/01-05_*` — business rules applied in each notebook; `Documentation/StakeholderDocuments/BUSINESS_RULES_AND_ETL_SUMMARY.md`; Constitution Principle II.

---

### A25 — External Denominator Database (Separate Server)

**Assumption**: The canonical denominator view `[InventoryAnalysis].[dbo].[vw_USTaxBTS_FY26_MaxACD]` resides on an **external, Mercury-managed SQL Server instance** that is independent of the ATTG_Usage application database. Direct cross-server queries from ATTG_Usage (via linked-server, `OPENROWSET`, or `OPENQUERY`) **cannot be assumed** and may be blocked by network policy, firewall rules, or credential isolation. Therefore:

1. ADF `PL_DenomLoad_Weekly` is the **sole bridge** between the external Mercury server and the application database. ADF uses its own Linked Service credentials to connect to the external server.
2. Denominator data is materialized locally into `stage.DenominatorSnapshot` (truncate + full reload weekly).
3. All stored procedures and pipeline steps operate exclusively on the local copy (`app.vw_DenominatorLocal`) — never on the external view.
4. No application-layer code (Next.js API, SPs) ever references the external server.

**Impact if wrong**: If the external server were accessible via linked-server, the local snapshot step could theoretically be skipped — but maintaining the local copy is still recommended for performance isolation, resilience to network outages, and to avoid holding long transactions on the external server.

**Source**: Stakeholder confirmation that the denominator view is hosted on a separate, independently-managed server; `Documentation/ProjectSpecifications/architecture.md` v1.3.0 — Section 4.4.2, Section 5.1.

---

### A26 — Investment Data Source Requires Governance Approval Before KPI Usage

**Assumption**: Investment-aware KPIs are blocked until a single authoritative investment source and ownership model are approved.

**Impact if wrong**: Investment metrics may be inconsistent across reporting periods, requiring re-baselining and delayed releases.

**Source**: `Documentation/StakeholderDocuments/ApplicationGoals.md` — investment source gap and phased delivery statements.

---

### A27 — Investment Ingestion Must Include Reconciliation Controls

**Assumption**: Investment ingestion is considered complete only when source-to-target reconciliation and exception outputs are available.

**Impact if wrong**: Financial KPI trustworthiness cannot be demonstrated for audit/review cycles.

**Source**: `Documentation/StakeholderDocuments/ApplicationGoals.md` — ETL control and reconciliation intent.

---

### A28 — IaC and CD Remain Separate Planned Workstreams

**Assumption**: EPIC-BQM-011 (IaC) and EPIC-BQM-012 (CD) remain distinct roadmap items with independent governance gates.

**Impact if wrong**: Coupling platform provisioning and release automation would increase delivery risk and reduce controllability.

**Source**: `Documentation/Backlog/epics/epic-011-azure-infrastructure-iac.md`, `Documentation/Backlog/epics/epic-012-cd-pipeline.md`.

---

### A29 — Advanced Date Controls Deferred After Dashboard Baseline

**Assumption**: Date-based period selectors and time-trend controls (EPIC-BQM-015) are deferred until EPIC-BQM-014 dashboard baseline is stable and production-validated. Current dashboard UI scope does not include date filtering.

**Impact if wrong**: Introducing date controls in the same sprint as baseline rendering would increase scope risk and complicate RBAC testing.

**Source**: `Documentation/StakeholderDocuments/ApplicationGoals.md` — Section 16, "Date-based filtering control is deferred in current UI release."

---

### A30 — On Target Rate Threshold Governance Requires Effective-Date Policy

**Assumption**: Any modification to the default On Target threshold (70%) requires an approved policy version with an effective date. No threshold changes are applied without this governance record.

**Impact if wrong**: If threshold changes are applied without versioning, historical KPI comparisons become inconsistent and audit evidence is unreliable.

**Source**: `Documentation/StakeholderDocuments/ApplicationGoals.md` — Section 11, threshold governance.

---

### A31 — Benchmark Alerting Requires Approved Benchmark Definitions

**Assumption**: Benchmark and below-target alert delivery (EPIC-BQM-015) depends on approved benchmark definitions and threshold policies. No alerts are issued until definitions are finalized and signed off.

**Impact if wrong**: Premature alert deliveries without governance sign-off may produce incorrect or misleading leadership outputs.

**Source**: `Documentation/StakeholderDocuments/ApplicationGoals.md` — Section 11, risk mitigation.

---

### A32 — AI Suggestions Are Advisory and Require Explicit User Approval

**Assumption**: AI-generated denominator filter rules and adoption settings are recommendations only. No AI output is persisted as active configuration unless an authorized user explicitly accepts and saves it.

**Impact if wrong**: Auto-applying AI recommendations could introduce unapproved business-rule drift and audit failures.

**Source**: `Documentation/StakeholderDocuments/ApplicationGoals.md` — Functional requirements and governance intent.

---

### A33 — AI Analysis Uses Governed Metric Outputs Only

**Assumption**: AI dashboard analysis consumes only governed, role-scoped metric payloads and metadata already available through approved APIs.

**Impact if wrong**: If AI analysis uses non-governed sources, user trust and traceability are compromised.

**Source**: `Documentation/StakeholderDocuments/ApplicationFeatures.md` — AI-assisted rules and insights section.

---

### A34 — AI Recommendation Responses Must Be Auditable

**Assumption**: The system records request context and user acceptance/rejection outcomes for AI recommendations in audit trails.

**Impact if wrong**: AI-assisted configuration decisions cannot be explained during governance or compliance reviews.

**Source**: `Documentation/ProjectSpecifications/architecture.md` — API security and audit requirements.

---

### A35 — Numerator Deduplication Uses Composite Key (ClientId + EngagementId)

**Assumption**: Numerator deduplication in the processing pipeline uses a composite key of `ClientId + EngagementId` to detect duplicates. Records are only considered duplicates when **both** fields match. This is independent of the application's `AdoptionLevel` setting (which determines the matching key in Step 5 but not the deduplication key in Step 3). The PRD source notebooks (Maestro) explicitly deduplicate by "Client Id + Engagement Id combination."

**Impact if wrong**: If single-key deduplication is retained, legitimate distinct records sharing one key component may be incorrectly collapsed (false positives), or true duplicates differing in one field may pass through (false negatives), inflating or deflating adoption metrics.

**Source**: `Documentation/StakeholderDocuments/BUSINESS_RULES_AND_ETL_SUMMARY.md` — Maestro section: "Deduplicate by Client Id + Engagement Id combination"; `Documentation/StakeholderDocuments/notebooks/01_maestro_pcs.ipynb` — deduplication logic.

---

### A36 — Denominator Impact Preview Operates on Local Snapshot Only

**Assumption**: The denominator rules impact preview feature operates exclusively against the local `app.vw_DenominatorLocal` (backed by `stage.DenominatorSnapshot`), not against the external Mercury server. Preview results reflect the freshness of the last successful `PL_DenomLoad_Weekly` run. The preview runs the full pipeline via Option D (see A39) but all data access remains local.

**Impact if wrong**: If preview requires live Mercury access, it would be subject to the same connectivity constraints as the external server (A25) and could fail or timeout when the Mercury server is unreachable.

**Source**: `Documentation/ProjectSpecifications/architecture.md` v1.5.0 — Section 4.8; A25; A39.

---

### A37 — Optimistic Concurrency for Rules Configuration (No Pessimistic Locks)

**Assumption**: The rules configuration system uses **optimistic concurrency control** (version-check at save time) rather than pessimistic database-level locks. Advisory "soft locks" (edit sessions) are informational and never block other users from loading, editing, or saving. This is appropriate because: (a) the expected concurrent editor count is low (< 5 users at any time), (b) the edit window is short (minutes, not hours), and (c) conflicts are infrequent since different application owners typically edit different applications.

**Impact if wrong**: If concurrent editor count is higher than expected or if conflicts become frequent, the system may need to escalate to pessimistic locking (exclusive edit mode) or real-time collaborative editing (CRDT/OT). The current design degrades gracefully — more conflicts simply mean more 409 responses and manual merges, but no data is ever lost.

**Source**: `Documentation/Backlog/epics/epic-017-impact-preview-and-numerator-deduplication.md` v1.1.0 — Feature C; `Documentation/ProjectSpecifications/architecture.md` — Section 4.7 Concurrency Control.

### A38 — Bearer Token via Authorization Header (No Auth Cookies Due to WAF)

**Assumption**: All API authentication uses a **Bearer token** passed in the `Authorization` header. The token is stored in client `sessionStorage` (tab-scoped). Auth cookies (e.g., NextAuth/Auth.js JWTs) are **not** used for API authentication because corporate WAF (Web Application Firewall) appliances on Azure Front Door intercept, strip, or rewrite `Set-Cookie` headers — causing intermittent auth failures. Standard `Authorization: Bearer` headers pass through WAFs unmodified.

**Impact if wrong**: If the WAF policy changes to allow large auth cookies, the system could revert to cookie-based auth. However, the sessionStorage approach also provides XSS exposure reduction (cleared on tab close) and tab isolation, so the current pattern is preferred regardless. If `sessionStorage` is unavailable (e.g., embedded iframes with storage partitioning), an alternative transport would be needed.

**Source**: `src/frontend/lib/auth/session-token.ts`; `src/frontend/lib/auth/bearer-token.ts`; `Documentation/ProjectSpecifications/architecture.md` — Section 7.1.

---

### A39 — Impact Preview Runs Full Pipeline via Staged Rules (Option D)

**Assumption**: The denominator rules impact preview feature runs the **full existing pipeline** (`usp_ExecutePipelineRun` → `usp_BuildFilteredDenominator` → `usp_ApplyNumeratorFilters` → `usp_CalculateMetrics`) with an optional `@previewSessionId` parameter that redirects rule source from `app.DenominatorFilterRules` to `stage.DenominatorFilterRulesPreview`. This is Option D from the evaluated alternatives (A–D). Preview results include complete adoption metrics (adoption %, revenue share %, matched count, denominator count, denominator revenue) and are guaranteed identical to production pipeline output because the same code path executes.

**Impact if wrong**: If the pipeline cannot be parameterized (e.g., hard-coded references that can't accept a session branch), a dedicated preview SP (Option B) would be required — adding ~500 lines of duplicate T-SQL with permanent drift risk and violating the "no SP testing" constraint.

**Source**: `specs/012-impact-preview-dedup-concurrency/preview-options-comparison.md` — Option D; `Documentation/ProjectSpecifications/architecture.md` — Section 4.8.

---

### A40 — SSE for Preview Result Delivery (No Polling, No SignalR)

**Assumption**: Preview results are delivered to the client via **Server-Sent Events (SSE)** — the `POST /api/filters/denominator/:appId/preview` endpoint returns `Content-Type: text/event-stream` and streams status/completion events on a single held-open HTTP connection. No client-side polling hooks, no WebSocket/SignalR infrastructure. In local mode, the connection is held open during SP execution (3–8s). In ADF mode, the server polls `PipelineRuns` status internally and pushes events to the client.

**Impact if wrong**: If corporate proxies or Azure Front Door buffer chunked/streaming responses despite `X-Accel-Buffering: no`, the system would need to fall back to SignalR (WebSocket) which requires an Azure SignalR Service resource and `@microsoft/signalr` package. This is the documented scale path for enterprise phase.

**Source**: `specs/012-impact-preview-dedup-concurrency/preview-options-comparison.md` — SSE Deep Dive; `Documentation/ProjectSpecifications/architecture.md` — Section 4.8.5.

---

### A41 — ADF Direct Call for Preview Execution (No Background Worker for MVP)

**Assumption**: Preview pipeline execution uses the existing `PipelineOrchestrationService` and `ADFPipelineClient` (ADF mode) or `ValidationPipelineDbRepository.executeLocalPipeline()` (local mode) — the same infrastructure already used for production pipeline triggers. No background worker (Azure Function + Queue) is deployed for MVP. The background worker is the documented scale path when ADF concurrency becomes a measured bottleneck (50+ concurrent previews).

**Impact if wrong**: If ADF webhook cold start (2–5s) combined with pipeline execution (3–15s) causes unacceptable preview latency at scale, a background worker with queue backpressure would need to be introduced. The architecture is designed for this — `resolveExecutionMode()` already abstracts the executor, so adding a third mode (`"worker"`) requires no client-facing or API changes.

**Source**: `specs/012-impact-preview-dedup-concurrency/preview-options-comparison.md` — Direct ADF Call vs. Background Worker; `Documentation/ProjectSpecifications/architecture.md` — Section 4.8.4.

---

### A42 — No Concurrency Guard for Preview Runs

**Assumption**: Preview pipeline runs intentionally **bypass** the production concurrency guard (`409 CONFLICT` if a run is already in progress). Each preview is session-isolated via `SessionId` in `stage.DenominatorFilterRulesPreview` and tagged `TriggerSource = 'Preview'`. Multiple concurrent previews for the same application operate independently and do not affect dashboard metrics. The worst case (user fires 2–3 overlapping previews) results only in extra SP executions — acceptable at < 20 concurrent users.

**Impact if wrong**: If previews consume significant database resources at scale (200+ concurrent previews against the same snapshot), a per-user throttle (e.g., max 1 active preview per user) may be needed. The `PipelineRuns` table already tracks preview runs by `ActorUserId`, enabling this guard if required.

**Source**: `specs/012-impact-preview-dedup-concurrency/preview-options-comparison.md` — "Concurrency: No Guard for Preview"; `Documentation/ProjectSpecifications/architecture.md` — Section 4.8.6.

---

### A43 — Stale Run Recovery at 30-Minute Threshold

**Assumption**: The production pipeline concurrency guard includes a **time-based staleness check**: if the latest in-progress run (`Queued` or `Processing`) is older than 30 minutes, it is auto-failed with `Status = 'Failed'` and `ErrorMessage = 'Auto-failed: exceeded 30min threshold'`, allowing the new run to proceed. This prevents permanent blocking from SP timeouts, ADF crashes, or network failures. Defense-in-depth: a SQL Agent job runs every 15 minutes to catch stuck runs even if the app process crashes.

**Impact if wrong**: If legitimate pipeline runs take > 30 minutes (only possible at 500K+ rows with severe resource contention), the threshold would need to be increased. Current data: normal execution is 3–8s, worst case is 15–60s, ADF timeout is 10 minutes — so 30 minutes provides a 3× safety margin over the absolute worst case.

**Source**: `specs/012-impact-preview-dedup-concurrency/preview-options-comparison.md` — Stale Run Recovery; `Documentation/ProjectSpecifications/architecture.md` — Section 4.8.6.

---

## Open Questions from PRD

These questions from the PRD remain unresolved and should be confirmed with stakeholders:

| # | Question | Source | Impact |
|---|----------|--------|--------|
| OQ1 | How often does Numerator data need to be updated per application? | `AUTOMATED_SOLUTION_ARCHITECTURE.md` | Determines pipeline scheduling for EPIC-BQM-006 |
| OQ2 | Who is responsible for maintaining each application's Numerator data? | `AUTOMATED_SOLUTION_ARCHITECTURE.md` | Affects user/role setup in EPIC-BQM-002 |
| OQ3 | If an engagement appears in conflicting classifications, which wins? | `AUTOMATED_SOLUTION_ARCHITECTURE.md` | Impacts matching logic in EPIC-BQM-006 |
| OQ4 | How far back should historical adoption trends be viewable? | `AUTOMATED_SOLUTION_ARCHITECTURE.md` | Affects MetricSnapshots retention policy |
| OQ5 | Should users be notified when Numerator data becomes stale? | `AUTOMATED_SOLUTION_ARCHITECTURE.md` | Potential future feature; not in current scope |
| OQ6 | Final definition of On Target: engagement-only or composite score? | `ApplicationGoals.md` Section 21 | Affects On Target Rate calculation and EPIC-BQM-007 US047 |
| OQ7 | Authoritative investment source selection and ownership model | `ApplicationGoals.md` Section 14 | Blocks EPIC-BQM-013 entirely |
| OQ8 | Required leadership reporting cadence (daily, weekly, quarterly)? | `ApplicationGoals.md` Section 21 | Affects pipeline scheduling and ADF trigger configuration |
| OQ9 | Required drill-down dimensions for v1 dashboard | `ApplicationGoals.md` Section 21 | Affects EPIC-BQM-015 scope boundaries and story prioritization |
| OQ10 | Should AI recommendations include confidence scoring and explanation detail by default? | `ApplicationGoals.md` Section 21 | Affects EPIC-BQM-016 UX and acceptance workflow |

---

## PRD References

| Document | Path |
|----------|------|
| Application Goals | `Documentation/StakeholderDocuments/ApplicationGoals.md` |
| Application Features | `Documentation/StakeholderDocuments/ApplicationFeatures.md` |
| Solution Architecture | `Documentation/StakeholderDocuments/AUTOMATED_SOLUTION_ARCHITECTURE.md` |
| Business Rules & ETL | `Documentation/StakeholderDocuments/BUSINESS_RULES_AND_ETL_SUMMARY.md` |
| Constitution | `.specify/memory/constitution.md` |
| Notebook — Data Loading | `Documentation/StakeholderDocuments/notebooks/00_header_data_loading.ipynb` |
| Notebook — Maestro | `Documentation/StakeholderDocuments/notebooks/01_maestro_analysis.ipynb` |
| Notebook — EYST | `Documentation/StakeholderDocuments/notebooks/02_eyst.ipynb` |
| Notebook — Prodigy | `Documentation/StakeholderDocuments/notebooks/03_prodigy.ipynb` |
| Notebook — Vector | `Documentation/StakeholderDocuments/notebooks/04_vector_analysis.ipynb` |
| Notebook — Navigate | `Documentation/StakeholderDocuments/notebooks/05_navigate_analysis.ipynb` |
