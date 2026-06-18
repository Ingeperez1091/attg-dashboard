# BQM-US060 — Composite-Key Numerator Deduplication in Pipeline

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-017 (Impact Preview & Numerator Composite-Key Deduplication)  
> **Priority**: 1 — Critical | **Phase**: Phase 2  
> **Changelog**: v1.0.0 — Initial story; defines ClientId+EngagementId composite key for numerator duplicate detection.

---

### :bust_in_silhouette: User Story

**As a** data engineer  
**I want** the numerator processing pipeline to detect duplicates using a composite key of `ClientId + EngagementId`  
**So that** legitimate records sharing a single key component are preserved while true duplicates (matching both fields) are correctly identified and excluded from metric calculations.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** two numerator records with the same `ClientId` AND the same `EngagementId`, **When** the pipeline processes them, **Then** the earlier record (by StageId/ItemIndex) is flagged as a duplicate and only the latest record is promoted.
- **Given** two numerator records with the same `ClientId` but different `EngagementId` values, **When** the pipeline processes them, **Then** both records are treated as distinct (neither is flagged as duplicate).
- **Given** two numerator records with the same `EngagementId` but different `ClientId` values, **When** the pipeline processes them, **Then** both records are treated as distinct (neither is flagged as duplicate).
- **Given** a batch with N total records and D composite-key duplicates, **When** the pipeline completes, **Then** `PipelineRuns.DuplicateCount = D` (where D counts the extra occurrences beyond the first per composite key).
- **Given** a duplicate record is detected, **When** `ValidationResults` is persisted, **Then** the duplicate record's `Status = 'Duplicate'` and includes the composite key reference in the error context.
- **Given** the `AdoptionLevel` is "Engagement" for an application, **When** deduplication runs, **Then** the composite key still uses BOTH `ClientId + EngagementId` (deduplication is independent of the matching key).
- **Given** the `AdoptionLevel` is "Client" for an application, **When** deduplication runs, **Then** the composite key still uses BOTH `ClientId + EngagementId` (deduplication is independent of the matching key).
- **Given** a numerator record has a NULL `ClientId` or NULL `EngagementId`, **When** processed, **Then** it is flagged as invalid (missing key field) — not treated as a duplicate.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK211] Modify `usp_ExecutePipelineRun` — change `ROW_NUMBER() OVER (PARTITION BY ...)` from single-key to composite-key: `PARTITION BY JSON_VALUE(item.ItemJson, '$.clientId'), JSON_VALUE(item.ItemJson, '$.engagementId')`.
- [ ] [BQM-TK212] Update `#ParsedNumerator` temp table definition and INSERT to carry both `ClientId` and `EngagementId` as separate columns alongside the existing `RecordKey` (which remains determined by `AdoptionLevel` for matching purposes).
- [ ] [BQM-TK213] Update `ValidationResults` duplicate-flagging logic to reference the composite key in error context (e.g., "Duplicate: ClientId=X, EngagementId=Y").
- [ ] [BQM-TK214] Ensure `DuplicateCount` calculation in run-finalization uses the new composite-key partition.
- [ ] [BQM-TK215] Add database migration script (`0XX_alter_dedup_composite_key.sql`) if temp table or validation result schema changes require DDL.
- [ ] [BQM-TK216] Write unit tests: same-client-different-engagement (distinct), same-engagement-different-client (distinct), full composite duplicate (flagged), null key handling (invalid).
- [ ] [BQM-TK217] Write integration test: end-to-end pipeline run with mixed duplicate/distinct records validates final `DuplicateCount`, `ValidCount`, and `MatchedCount`.

### :link: Links

- **Epic:** EPIC-BQM-017 (`Documentation/Backlog/epics/epic-017-impact-preview-and-numerator-deduplication.md`)
- **Architecture:** `Documentation/ProjectSpecifications/architecture.md` v1.3.0 — Section 4.4 ADF Pipeline Step 3 (Parse & Validate Numerator, deduplication via ROW_NUMBER)
- **Source Code:** `database/stored-procedures/usp_ExecutePipelineRun.sql` — lines ~186–196 (current single-key PARTITION BY)
- **Spec:** `specs/007-validation-processing-pipeline/spec.md` — FR-005 (duplicate detection)
- **PRD:** `StakeholderDocuments/BUSINESS_RULES_AND_ETL_SUMMARY.md` — Maestro: "Deduplicate by Client Id + Engagement Id combination"
- **Assumptions:** `Documentation/ProjectSpecifications/assumptions.md` — A8 (single match key per app — this remains for matching; deduplication uses composite key)
- **Constitution:** Principle I — Data Integrity
- **Sprint:** (Assign via Milestone)

### Business Rules

- **Deduplication key**: `ClientId + EngagementId` (composite). This is independent of the application's `AdoptionLevel` setting.
- **Matching key** (Step 5): Remains determined by `AdoptionSettings.AdoptionLevel` (EngagementID or ClientID). Only deduplication changes.
- **Ordering**: Among composite duplicates, keep the **latest** record by `StageId DESC, ItemIndex DESC` (newest submission wins).
- **Null handling**: Records with NULL or empty string in either `ClientId` or `EngagementId` are flagged as invalid (missing key field), not as duplicates.
- **Counting**: `DuplicateCount` counts the number of **extra** occurrences (i.e., records with `DuplicateRank > 1`), not the total number of records involved in duplication.

### Data Impact & Pipelines

- **Reads:** `stage.EngagementUsageRaw` (numerator payloads), `app.ApplicationModels` (field definitions for JSON path extraction).
- **Writes:** `app.ValidationResults` (duplicate-flagged records with composite key context), `app.PipelineRuns` (updated `DuplicateCount`).
- **Pipelines:** `PL_MetricsProcessing` Step 3 — invokes `usp_ExecutePipelineRun` which contains the modified deduplication logic.
- **Migration:** Potential DDL migration for adding composite-key columns to temp table or adjusting validation result error message format.
