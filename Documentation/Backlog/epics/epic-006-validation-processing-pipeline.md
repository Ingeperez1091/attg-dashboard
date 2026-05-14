# EPIC-BQM-006 — Data Validation & Processing Pipeline

> **Azure DevOps Work Item Type**: Epic  
> **ADO ID**: _TBD — to be assigned upon creation in Azure DevOps_  
> **ADO Link**: _TBD_  
> **Phase**: Extended-MVP  
> **Last Updated**: 2026-04-16 — aligned with `Documentation/ProjectSpecifications/architecture.md` v1.3.0 (external denominator DB)

---

## :dart: Objective

Build the **single parameterised ADF pipeline** (`PL_MetricsProcessing`) that validates numerator data against the filtered denominator, applies per-application filter rules (both numerator and denominator) via stored procedures, matches records, and prepares the result set for metric calculation — all within one pipeline execution per application.

## :memo: Description (ADO)

Implement the data validation and processing layer as a **single ADF pipeline parameterised on `ApplicationId`** (`PL_MetricsProcessing`). The pipeline performs six sequential steps entirely within Azure SQL stored procedures (no ADF Data Flows) for maximum performance on sub-100K-row volumes:

1. **Configuration Lookups** — Parallel lookups of `AdoptionSettings`, `ApplicationModels`, `DenominatorModels`, `DenominatorFilterRules`, and `NumeratorFilterRules` for the target application.
2. **Build Filtered Denominator** — Execute `[app].[usp_BuildFilteredDenominator]` which reads the **local** `app.vw_DenominatorLocal` view (a materialized copy of the external Mercury view — see A25), applies rules from `DenominatorFilterRules` + `DenominatorModels` as dynamic SQL WHERE clauses (AND-combined), and populates a temp table `#FilteredDenom`.
3. **Parse & Validate Numerator** — Read `stage.EngagementUsageRaw`, parse JSON payloads using `OPENJSON` driven by `ApplicationModels.SourcePath`, coerce data types (`TRY_CAST`), detect duplicates (`ROW_NUMBER`), validate IDs via `LEFT JOIN #FilteredDenom`, and persist results to `app.ValidationResults`.
4. **Apply Numerator Filter Rules** — Execute `[app].[usp_ApplyNumeratorFilters]` which evaluates field-operator-value expressions (AND-combined) on validated records, marking excluded records with the specific rule that rejected them.
5. **Match Numerator ∩ Denominator** — `INNER JOIN` on the match key determined by `AdoptionSettings.AdoptionLevel` (EngagementID for engagement-level apps; ClientID for client-level apps). Output to `app.MatchedRecords`.
6. **Calculate Metrics & Persist Snapshot** — Compute Adoption % and Revenue % using the matched set (deferred detail in EPIC-BQM-007), insert into `app.MetricSnapshots`, update `app.PipelineRuns` status.

Invalid or unmatched IDs are surfaced to the user with clear error context — they never silently inflate or deflate adoption metrics. Raw source data in `stage.EngagementUsageRaw` is never modified in place.

A companion pipeline **`PL_MetricsOrchestrator`** (ForEach over active applications, batch concurrency = 5) invokes `PL_MetricsProcessing` per application. A separate **`PL_DenomLoad_Weekly`** pipeline loads denominator data from the external Mercury server into the local `stage.DenominatorSnapshot` table on a weekly schedule (the external Mercury view is on an independent server that cannot be queried directly from the application database — ADF bridges this gap; see assumption A25).

## :chart_with_upwards_trend: Business Value

The validation and filtering pipeline is the core data quality gate. Without it, raw numerator data cannot be trusted for metric calculation, and adoption percentages would be unreliable. The single-pipeline-per-app design ensures consistent, auditable processing with full pipeline-run traceability.

## :white_check_mark: Acceptance Criteria

- [ ] `PL_MetricsProcessing` pipeline accepts `ApplicationId` parameter and executes Steps 1–6 for that application.
- [ ] Step 2 executes `[app].[usp_BuildFilteredDenominator]` using rules from `app.DenominatorFilterRules` joined with `app.DenominatorModels`.
- [ ] Step 3 parses JSON payloads via `OPENJSON` using `ApplicationModels.SourcePath` column definitions.
- [ ] Step 3 validates IDs via `LEFT JOIN` against the filtered denominator — invalid IDs flagged with reason.
- [ ] Step 3 detects duplicates via `ROW_NUMBER() OVER (PARTITION BY matchKey)`.
- [ ] Step 4 executes `[app].[usp_ApplyNumeratorFilters]` using rules from `app.NumeratorFilterRules` joined with `app.ApplicationModels`.
- [ ] Step 5 matches using the key from `AdoptionSettings.AdoptionLevel` (EngagementID or ClientID).
- [ ] Validation results persisted to `app.ValidationResults` with StageId, ID, IsValid, reason, and PipelineRunId.
- [ ] Pipeline run metadata persisted to `app.PipelineRuns` (start, end, status, row counts).
- [ ] Pipeline runs asynchronously without blocking user sessions.
- [ ] Raw data preserved in staging — never modified in place.
- [ ] All stored procedures use parameterised queries to prevent SQL injection.
- [ ] Pull requests pass baseline CI quality gates (lint, type-check, automated tests).

## :link: Dependencies

- EPIC-BQM-001 (Database Foundation — schema, views, tables)
- EPIC-BQM-003 (Numerator Ingestion API — staged data in `stage.EngagementUsageRaw`)
- EPIC-BQM-004 (Numerator Filter Configuration — `app.NumeratorFilterRules`, `app.ApplicationModels`)
- EPIC-BQM-005 (Auth — application-scoped access)
- EPIC-BQM-008 (Denominator Rules Configuration — `app.DenominatorFilterRules`, `app.DenominatorModels`, `app.AdoptionSettings`)
- EPIC-BQM-010 (CI Pipeline — baseline CI merged to protected trunk branches before epic source-code tasks begin)

## :classical_building: Architecture & Design Notes

- `Documentation/ProjectSpecifications/architecture.md` v1.3.0 — Section 4.4 (ADF Pipeline Inventory, `PL_MetricsProcessing` 6-step flow, Performance Optimisation table)
- `Documentation/ProjectSpecifications/architecture.md` v1.3.0 — Section 4.3 (External View & Local Snapshot)
- `Documentation/ProjectSpecifications/architecture.md` v1.3.0 — Section 5 (Data Flow Detail)
- `Documentation/ProjectSpecifications/architecture.md` v1.3.0 — Section 6 (Validation Rules, per-app denominator rules)
- `Documentation/ProjectSpecifications/assumptions.md` v1.3.0 — A18 (SP over Data Flows), A19 (OPENJSON), A22 (one app per execution), A25 (external denominator DB)

## :clipboard: Scope

**In Scope:**
- ADF pipeline `PL_MetricsProcessing` (Steps 1–5: config lookups, build filtered denominator, parse/validate numerator, apply numerator filters, match)
- ADF pipeline `PL_MetricsOrchestrator` (ForEach over active applications)
- ADF pipeline `PL_DenomLoad_Weekly` (external Mercury server → local `stage.DenominatorSnapshot` table)
- Stored procedures: `[app].[usp_BuildFilteredDenominator]`, `[app].[usp_ApplyNumeratorFilters]`
- Tables: `app.ValidationResults`, `app.MatchedRecords`, `app.PipelineRuns`
- Validation result persistence and error surfacing

**Out of Scope:**
- Metric calculation logic and `app.MetricSnapshots` persistence (EPIC-BQM-007 — Step 6)
- Denominator rules configuration UI (EPIC-BQM-008 — already delivered)
- Numerator filter rules configuration UI (EPIC-BQM-004 — already delivered)

## :book: Linked User Stories

- [ ] [BQM-US019] Validate numerator IDs against denominator
- [ ] [BQM-US020] Apply numerator filters per application config
- [ ] [BQM-US021] Apply denominator filters per application config
- [ ] [BQM-US022] Surface validation errors to users

## :white_check_mark: Definition of Done (DoD)

- [ ] All linked User Stories are closed.
- [ ] Integration testing completed.
- [ ] `PL_MetricsProcessing` end-to-end validated with at least one application's real data.

## :page_facing_up: PRD References

- `StakeholderDocuments/AUTOMATED_SOLUTION_ARCHITECTURE.md` — Processing Layer diagram
- `StakeholderDocuments/BUSINESS_RULES_AND_ETL_SUMMARY.md` — All application business rules
- `.specify/memory/constitution.md` — Principle I (Data Integrity), Principle III (Validated Ingestion)
