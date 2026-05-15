# BQM-US021 — Apply Denominator Filters per Application Config

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-006 (Data Validation & Processing Pipeline)  
> **Priority**: 1 — Critical | **Phase**: Extended-MVP  
> **Last Updated**: 2026-04-16 — aligned with `Documentation/ProjectSpecifications/architecture.md` v1.3.0 (external denominator DB)

---

### :bust_in_silhouette: User Story

**As a** data engineer  
**I want to** have the pipeline apply denominator filter rules from each application's configuration  
**So that** the addressable population is correctly scoped before calculating adoption percentages.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** Maestro has denominator rules [ServiceCode IN (11420), ReleaseDate > 01/01/2025, Status IN (Closing, Completed, Pre-Closing, Released), Revenue > 0, Exclude Names containing pof|perseus|pt|ITR|BTA|Bison], **When** Step 2 of `PL_MetricsProcessing` executes `[app].[usp_BuildFilteredDenominator]`, **Then** only matching engagements populate `#FilteredDenom`.
- **Given** EYST has denominator rules [ServiceCode IN (11420), Status IN (Closing, Completed, Pre-Closing, Released), Revenue > 0], **When** Step 2 runs, **Then** only matching engagements form the denominator (client-level dedup applied downstream).
- **Given** Prodigy has denominator rules [ServiceCode IN (10676), ReleaseDate > 01/01/2024, Revenue > 0], **When** Step 2 runs, **Then** only matching engagements form the denominator.
- **Given** Vector has denominator rules [ServiceCode IN (11420), ReleaseDate > 01/01/2025, Status IN (Closing, Completed, Pre-Closing, Released), Revenue > 10000, Exclude Names containing pof|perseus|pt|ITR|BTA|Bison], **When** Step 2 runs, **Then** only matching engagements form the denominator.
- **Given** Navigate has denominator rules [AccountChannel = Major], **When** Step 2 runs, **Then** only `Major` channel engagements form the denominator.
- **Given** filter rules are stored in `app.DenominatorFilterRules` with column references from `app.DenominatorModels`, **When** the SP builds dynamic SQL WHERE clauses against the **local** `app.vw_DenominatorLocal` (materialized copy of the external Mercury view — see A25), **Then** rules are applied sequentially as AND-combined predicates.
- **Given** the SP completes, **When** the result set is produced, **Then** row counts at each filter stage are recorded for observability.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK079] Implement `[app].[usp_BuildFilteredDenominator]` stored procedure: accept `@ApplicationId` and `@DenomRulesJson` (serialised rules from Step 1 lookup), start from **local** `app.vw_DenominatorLocal` (not the external Mercury view directly — see A25), build dynamic SQL WHERE clauses from `DenominatorFilterRules` + `DenominatorModels.SourceColumn`, populate temp table `#FilteredDenom`
- [ ] [BQM-TK080] Implement all filter types within the SP: service code (IN), release date (>), engagement status (IN), revenue threshold (>), name exclusion (NOT LIKE), name inclusion (LIKE), account channel (=). Use parameterised queries for all value interpolation.
- [ ] [BQM-TK081] Write SP integration tests with known denominator data and expected filtered counts per application (Maestro 5 rules, EYST 3, Prodigy 3, Vector 5, Navigate 1)

### :link: Links

- **Epic:** EPIC-BQM-006 (`Documentation/Backlog/epics/epic-006-validation-processing-pipeline.md`)
- **Architecture:** `Documentation/ProjectSpecifications/architecture.md` v1.3.0 — Section 4.4.3, Step 2 (Build Filtered Denominator); Section 4.3 (External View & Local Snapshot); Section 6.2 (per-app denominator rules)
- **Assumptions:** `Documentation/ProjectSpecifications/assumptions.md` v1.3.0 — A24 (notebook rules as seed defaults), A25 (external denominator DB — SP uses local copy only)
- **PRD:** `StakeholderDocuments/BUSINESS_RULES_AND_ETL_SUMMARY.md` — Business Rules per application
- **Constitution:** Principle III — filter denominator using application-specific rules
- **Sprint:** (Assign via Milestone)

### Business Rules

- Rules are AND-combined. Name exclusion/inclusion uses case-insensitive pattern matching.
- Rules are model-driven: column references come from `DenominatorModels.SourceColumn`, allowing new denominator fields without code changes.
- Default seed rules per application come from the notebook ETL patterns (configurable via UI in EPIC-BQM-008).
- All dynamic SQL must use parameterised queries to prevent injection.

### Data Impact & Pipelines

- **Reads:** `app.vw_DenominatorLocal` (local weekly copy of external Mercury view), `app.DenominatorFilterRules` (per app), `app.DenominatorModels` (column definitions)
- **Writes:** Temp table `#FilteredDenom` (scoped to pipeline run connection; no cross-pipeline state pollution)
