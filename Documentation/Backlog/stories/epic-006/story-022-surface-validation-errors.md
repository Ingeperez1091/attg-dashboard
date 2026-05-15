# BQM-US022 — Surface Validation Errors to Users

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-006 (Data Validation & Processing Pipeline)  
> **Priority**: 2 — High | **Phase**: Extended-MVP  
> **Last Updated**: 2026-04-16 — aligned with `Documentation/ProjectSpecifications/architecture.md` v1.3.0

---

### :bust_in_silhouette: User Story

**As an** application owner  
**I want to** see which numerator IDs failed validation and why  
**So that** I can correct data issues in subsequent uploads rather than having errors silently ignored.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** a pipeline run produced validation errors in `app.ValidationResults`, **When** I call `GET /api/numerator/validation/:appId`, **Then** I receive a summary of invalid IDs with reasons, grouped by PipelineRunId.
- **Given** invalid IDs, **When** displayed in the UI, **Then** each shows the ID, error reason (e.g. "ID not found in denominator", "Missing Engagement/Client ID", "Duplicate", "Filtered out by rule X"), and the pipeline run date.
- **Given** no validation errors for the latest pipeline run, **When** I view the application, **Then** no error summary is shown and a success indicator is displayed.
- **Given** validation errors exist, **When** the metric is displayed, **Then** the metric does not include the invalid or filtered-out IDs.
- **Given** the validation endpoint is called, **When** it returns data, **Then** it respects application-scoped access (same rules as US018).

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK082] Implement `GET /api/numerator/validation/:appId` endpoint — query `app.ValidationResults` joined with `app.PipelineRuns` for the requested application; return invalid records with reason, StageId, PipelineRunId, and run date; enforce application-scoped access
- [ ] [BQM-TK083] Build validation errors UI component — display error summary grouped by pipeline run; show ID, reason, upload date; integrate with application detail view
- [ ] [BQM-TK084] Write tests for error surfacing API (valid/invalid app access, empty results, multiple pipeline runs) and metric exclusion (verify invalid IDs absent from metric calculations)

### :link: Links

- **Epic:** EPIC-BQM-006 (`Documentation/Backlog/epics/epic-006-validation-processing-pipeline.md`)
- **Architecture:** `Documentation/ProjectSpecifications/architecture.md` v1.3.0 — Section 4.4.3, Step 3f (ValidationResults persistence); `app.PipelineRuns` table
- **Constitution:** Principle III — "Invalid or unmatched IDs MUST be surfaced to the user"
- **Sprint:** (Assign via Milestone)

### Business Rules

- Invalid IDs never silently inflate or deflate adoption metrics.
- Validation errors are linked to a specific `PipelineRunId` for traceability.
- Users can only view validation errors for applications they are assigned to.

### Data Impact & Pipelines

- **Reads:** `app.ValidationResults` (joined with `app.PipelineRuns`), `app.UserApplications` (for access scoping)
- **Writes:** None — display only
