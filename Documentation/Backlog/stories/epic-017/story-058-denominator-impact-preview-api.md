# BQM-US058 — Denominator Rules Impact Preview API

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-017 (Impact Preview & Numerator Composite-Key Deduplication)  
> **Priority**: 1 — Critical | **Phase**: Phase 2  
> **Changelog**: v2.0.0 — Major rewrite for Option D implementation: preview now runs full pipeline via staged rules + `@previewSessionId`; result delivery via SSE streaming; async execution via existing ADF/local infrastructure; full adoption metrics (not just count/revenue); removed `usp_PreviewDenominatorImpact` SP (Option B); updated technical tasks, business rules, and data impact. v1.0.0 — Initial story; preview API endpoint for denominator rule impact analysis.

---

### :bust_in_silhouette: User Story

**As an** application owner  
**I want to** call a preview API that shows the projected adoption metrics (adoption %, revenue share %, matched count, denominator count, denominator revenue) when I modify filter rules  
**So that** I can verify the full impact of my proposed changes before committing them and avoid accidental metric distortions.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** I submit proposed denominator rules to `POST /api/filters/denominator/:appId/preview`, **When** the endpoint processes the request, **Then** it returns an SSE stream (`text/event-stream`) with status events followed by a `complete` event containing `current`, `projected`, `delta` (each with `adoptionPct`, `revenueSharePct`, `matchedCount`, `denominatorCount`, `denominatorRevenue`), plus `warnings[]` and `previewRunId`.
- **Given** I submit proposed rules, **When** the preview executes, **Then** it stages rules in `stage.DenominatorFilterRulesPreview` (session-scoped), invokes the full pipeline via `usp_ExecutePipelineRun` with `@previewSessionId`, and reads results from `app.MetricSnapshots` for the preview run.
- **Given** the application has `AdoptionSettings.RevenueMetric` configured, **When** the preview calculates metrics, **Then** the pipeline uses the correct revenue column (ETD or FYTD) from `app.vw_DenominatorLocal` — identical to production behavior.
- **Given** I am an `application_owner` or `administrator`, **When** I call the preview endpoint, **Then** I receive a 200 SSE stream with the impact data.
- **Given** I am a `viewer`, **When** I call the preview endpoint, **Then** I receive a 403 Forbidden response.
- **Given** the denominator snapshot is empty for the application's filters, **When** preview runs, **Then** it returns zero counts with appropriate warnings rather than failing.
- **Given** typical data volumes (< 50K denominator + < 50K numerator rows), **When** the pipeline executes, **Then** it completes within 5 seconds.
- **Given** the preview completes or fails, **When** the SSE stream closes, **Then** staged rules in `stage.DenominatorFilterRulesPreview` are cleaned up for that session.
- **Given** a preview run gets stuck (hypothetical), **When** 1 hour elapses, **Then** the staged rules are purged by `ExpiresAt` TTL and the orphaned `PipelineRun` is cleaned by the 24h retention job.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK200] Create database migration for `stage.DenominatorFilterRulesPreview` table — session-scoped staging table with `ExpiresAt` TTL, FK to `app.DenominatorModels`, covering indexes.
- [ ] [BQM-TK201] ALTER `app.usp_ExecutePipelineRun` — add optional `@previewSessionId UNIQUEIDENTIFIER = NULL` parameter; pass through to `usp_BuildFilteredDenominator`.
- [ ] [BQM-TK202] ALTER `app.usp_BuildFilteredDenominator` — add optional `@previewSessionId UNIQUEIDENTIFIER = NULL`; when non-NULL, read rules from `stage.DenominatorFilterRulesPreview WHERE SessionId = @previewSessionId` instead of `app.DenominatorFilterRules`. (~15 lines new SQL.)
- [ ] [BQM-TK203] Implement `POST /api/filters/denominator/:appId/preview` Next.js API route — SSE endpoint (`text/event-stream`): validates request body (Zod), inserts staged rules, triggers pipeline via `PipelineOrchestrationService`, streams status/complete/error events, cleans up staged rules on completion.
- [ ] [BQM-TK204] Extend `PipelineOrchestrationService` and `TriggerPipelineInput` DTO — add `"Preview"` to `triggerSource` union; add optional `previewSessionId` field.
- [ ] [BQM-TK205] Extend `ValidationPipelineDbRepository.executeLocalPipeline()` — pass `@previewSessionId` parameter to SP call.
- [ ] [BQM-TK206] Extend `ADFPipelineClient.triggerValidationPipeline()` — include `previewSessionId` in JSON body; update ADF pipeline parameters in `pipelines/metrics-processing/` to accept `previewSessionId` with default `""`.
- [ ] [BQM-TK207] Add role-based authorization guard — allow `application_owner` (for assigned apps) and `administrator`; deny `viewer`.
- [ ] [BQM-TK208] Implement stale run recovery — production concurrency guard auto-fails runs stuck > 30 minutes before checking for conflicts.
- [ ] [BQM-TK209] Write integration tests for the SSE preview endpoint (valid rules, empty snapshot, unauthorized access, staged rules cleanup, full metrics validation).
- [ ] [BQM-TK210] Add SQL Agent job definition for `stage.DenominatorFilterRulesPreview` TTL cleanup and preview `PipelineRuns` 24h retention.

### :link: Links

- **Epic:** EPIC-BQM-017 (`Documentation/Backlog/epics/epic-017-impact-preview-and-numerator-deduplication.md`)
- **Architecture:** `Documentation/ProjectSpecifications/architecture.md` v1.5.0 — Section 4.8 (Impact Preview — Option D: staged rules, SSE delivery, ADF execution, scale path)
- **Design:** `specs/012-impact-preview-dedup-concurrency/preview-options-comparison.md` — Full evaluation of Options A–D, async strategy, SSE deep dive
- **Assumptions:** `Documentation/ProjectSpecifications/assumptions.md` — A12 (shared model), A13 (AND-combined rules), A25 (external denominator DB), A39 (Option D — full pipeline preview), A40 (SSE result delivery), A41 (ADF direct call for MVP), A42 (no preview concurrency guard), A43 (stale run recovery)
- **PRD:** `StakeholderDocuments/AUTOMATED_SOLUTION_ARCHITECTURE.md` — "Denominator Preview: 2,909 engagements | $162.05M revenue"
- **Constitution:** Principle II — preview impact before applying
- **Related Story:** BQM-US028 (original preview story in EPIC-BQM-008; superseded by this focused implementation)
- **Sprint:** (Assign via Milestone)

### Business Rules

- Preview runs the **full production pipeline** (`usp_ExecutePipelineRun`) with proposed rules staged in `stage.DenominatorFilterRulesPreview` — results are guaranteed identical to production output.
- Preview applies proposed rules against the **local** denominator snapshot (`app.vw_DenominatorLocal`) — never the external Mercury server.
- Dynamic SQL is built using `DenominatorModels.SourceColumn` to map logical field names to actual view column names (inside the existing `usp_BuildFilteredDenominator`).
- Revenue column is determined by `AdoptionSettings.RevenueMetric` (ETD or FYTD) for the target application.
- Rules are AND-combined per assumption A13.
- The preview endpoint **writes** to: `stage.DenominatorFilterRulesPreview` (transient), `app.PipelineRuns` (tagged `TriggerSource = 'Preview'`), `app.MetricSnapshots`, `app.MatchedRecords`, `app.ValidationResults` — all tagged as preview artifacts and subject to 24h retention.
- Parameterized queries prevent SQL injection in dynamic WHERE clause construction (unchanged from production path).
- Preview runs bypass the production concurrency guard — multiple concurrent previews are allowed.
- Staged rules are cleaned up immediately after execution; orphaned rows are purged by TTL.

### Data Impact & Pipelines

- **Reads:** `app.DenominatorModels` (shared, ~17 rows), `app.DenominatorFilterRules` (current rules for "current" metrics comparison), `app.AdoptionSettings` (per-app — determines revenue column), `app.vw_DenominatorLocal` (local denominator data), `stage.EngagementUsageRaw` (numerator records), `app.MetricSnapshots` (latest non-preview metrics for current comparison).
- **Writes:** `stage.DenominatorFilterRulesPreview` (transient — inserted before run, deleted after), `app.PipelineRuns` (preview run record), `app.MetricSnapshots` (preview metrics), `app.MatchedRecords` (preview matches), `app.ValidationResults` (preview validation), `app.FilterRuleSnapshots` (preview rule snapshot).
- **Pipelines:** Triggers `PL_MetricsProcessing` via existing ADF webhook (production) or `executeLocalPipeline()` (development) with `previewSessionId` parameter. Preview is an **asynchronous** pipeline operation delivered via SSE streaming.
