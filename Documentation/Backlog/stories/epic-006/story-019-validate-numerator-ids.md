# BQM-US019 — Validate Numerator IDs Against Denominator

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-006 (Data Validation & Processing Pipeline)  
> **Priority**: 1 — Critical | **Phase**: Extended-MVP  
> **Last Updated**: 2026-04-16 — aligned with `Documentation/ProjectSpecifications/architecture.md` v1.3.0 (external denominator DB)

---

### :bust_in_silhouette: User Story

**As a** data engineer  
**I want to** validate that numerator Engagement/Client IDs exist in the filtered denominator  
**So that** only valid IDs contribute to adoption metrics and invalid entries are flagged for correction.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** staged numerator data in `stage.EngagementUsageRaw`, **When** Step 3 of `PL_MetricsProcessing` runs, **Then** JSON payloads are parsed via `OPENJSON` using `ApplicationModels.SourcePath` column definitions.
- **Given** parsed numerator records, **When** data type coercion runs, **Then** numeric fields use `TRY_CAST → NULL` on failure, dates use `TRY_CAST → NULL`, and strings are trimmed (`LTRIM(RTRIM(...))`).
- **Given** an ID that exists in `#FilteredDenom` (built from local `app.vw_DenominatorLocal` by Step 2), **When** validated via `LEFT JOIN`, **Then** it is marked as valid.
- **Given** an ID that does not exist in `#FilteredDenom`, **When** validated, **Then** it is marked as invalid with reason "ID not found in denominator".
- **Given** a NULL or empty ID, **When** validated, **Then** it is marked as invalid with reason "Missing Engagement/Client ID".
- **Given** duplicate IDs in the same upload, **When** validated via `ROW_NUMBER() OVER (PARTITION BY matchKey ORDER BY StageId DESC)`, **Then** only the latest record is kept; duplicates (rn > 1) are flagged.
- **Given** validation results, **When** persisted to `app.ValidationResults`, **Then** each row includes StageId, ID, IsValid, reason, and PipelineRunId.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK071] Implement Step 3a–3b: Read `stage.EngagementUsageRaw` (unprocessed for this app) and parse JSON payloads using `OPENJSON` with `ApplicationModels.SourcePath` column definitions
- [ ] [BQM-TK072] Implement Step 3c: Data type coercion — `TRY_CAST` for numeric/date, `LTRIM(RTRIM)` for strings; log coercion failures
- [ ] [BQM-TK073] Implement Step 3d: Duplicate detection — `ROW_NUMBER() OVER (PARTITION BY matchKey ORDER BY StageId DESC)`; flag rn > 1
- [ ] [BQM-TK074] Implement Step 3e–3f: ID validation via `LEFT JOIN #FilteredDenom` on match key (`EngagementID` or `ClientID` per `AdoptionSettings.AdoptionLevel`); persist results to `app.ValidationResults`
- [ ] [BQM-TK075] Write stored procedure integration tests with known fixture data (valid IDs, invalid IDs, duplicates, NULL IDs, coercion failures)

### :link: Links

- **Epic:** EPIC-BQM-006 (`Documentation/Backlog/epics/epic-006-validation-processing-pipeline.md`)
- **Architecture:** `Documentation/ProjectSpecifications/architecture.md` v1.3.0 — Section 4.4.3, Step 3 (Parse & Validate Numerator)
- **Assumptions:** `Documentation/ProjectSpecifications/assumptions.md` v1.3.0 — A19 (OPENJSON), A22 (one app per execution), A23 (classification from JSON), A25 (external denominator DB — JOINs use local copy only)
- **Constitution:** Principle III — validate IDs, reject duplicates, record validation results
- **Sprint:** (Assign via Milestone)

### Business Rules

- Invalid IDs must not inflate or deflate adoption metrics.
- Validation runs asynchronously as part of `PL_MetricsProcessing` Step 3.
- Match key is determined by `AdoptionSettings.AdoptionLevel`: EngagementID for engagement-level apps (Maestro, Vector, Navigate), ClientID for client-level apps (EYST, Prodigy).
- JSON field extraction is model-driven — new applications require only `ApplicationModels` rows, no code changes.

### Data Impact & Pipelines

- **Reads:** `stage.EngagementUsageRaw`, `#FilteredDenom` (temp table from Step 2, sourced from local `app.vw_DenominatorLocal`), `app.ApplicationModels` (field definitions), `app.AdoptionSettings` (match key)
- **Writes:** `app.ValidationResults` (one row per numerator record per pipeline run)
