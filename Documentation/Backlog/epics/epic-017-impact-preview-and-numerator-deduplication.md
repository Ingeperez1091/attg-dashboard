# EPIC-BQM-017 — Impact Preview & Numerator Composite-Key Deduplication

> **Azure DevOps Work Item Type**: Epic  
> **ADO ID**: _TBD — to be assigned upon creation in Azure DevOps_  
> **ADO Link**: _TBD_  
> **Phase**: Phase 2  
> **Changelog**: v1.2.0 — Updated Feature A (Impact Preview) to Option D implementation: staged rules table (`stage.DenominatorFilterRulesPreview`) + existing pipeline SP reuse with `@previewSessionId`; preview now returns full adoption metrics (not just count/revenue); async execution via ADF direct call (MVP); result delivery via SSE streaming; no concurrency guard for preview; stale run recovery (30min) for production guard; updated acceptance criteria. v1.1.0 — Added Feature C: Concurrent Rules Editing (optimistic concurrency, advisory locks, conflict resolution UI); added BQM-US061; updated scope and acceptance criteria. v1.0.0 — Initial epic; defines denominator rules impact preview as a standalone feature and introduces ClientId+EngagementId composite-key deduplication for numerator pipeline processing.

---

## :dart: Objective

Deliver three data-quality and user-confidence features: (1) a **real-time impact preview** that shows business owners the effect of denominator rule changes (record count and revenue total) before rules are committed, (2) a **composite-key deduplication strategy** using `ClientId + EngagementId` to detect and ignore duplicate numerator records during pipeline processing, preventing inflation of adoption metrics, and (3) a **concurrency control mechanism** that enables safe concurrent editing of rules configuration by multiple users with advisory locking, conflict detection, and clear resolution workflows.

## :memo: Description (ADO)

### Feature A — Denominator Rules Impact Preview (Option D — Staged Rules + Existing Pipeline SP Reuse)

Implement an end-to-end impact preview capability for denominator rule configuration changes. When a user modifies, adds, or removes denominator filter rules for an application, the system must provide a preview showing **complete adoption metrics** (adoption %, revenue share %, matched count, denominator count, denominator revenue) with a **current vs. projected** comparison **before** the changes are persisted. This gives business owners confidence that their configuration changes produce the intended result and prevents accidental metric distortion.

The implementation uses **Option D** (evaluated in `specs/012-impact-preview-dedup-concurrency/preview-options-comparison.md`): proposed rules are staged in `stage.DenominatorFilterRulesPreview` (session-scoped), and the **existing production pipeline** (`usp_ExecutePipelineRun`) is invoked with an optional `@previewSessionId` parameter. This runs the identical code path as production — zero logic duplication, guaranteed parity.

The preview feature includes:
- A dedicated SSE-streaming preview API endpoint (`POST /api/filters/denominator/:appId/preview`) that stages proposed rules, triggers the full pipeline, and streams results via Server-Sent Events.
- Async execution using the existing `PipelineOrchestrationService` (ADF direct call in production, local SP call in development).
- A UI component displaying side-by-side comparison of all adoption metrics (current committed rules vs. projected staged rules).
- Role-based access: `application_owner` and `administrator` can invoke preview; `viewer` cannot trigger rule changes.
- No concurrency guard for preview (session-isolated, non-destructive).
- Stale run recovery (30-minute threshold) for the production pipeline concurrency guard.

### Feature B — Numerator Composite-Key Deduplication

Enhance the numerator processing pipeline to use a **composite key** of `ClientId + EngagementId` for duplicate detection, replacing the current single-key approach that uses only one of the two fields based on `AdoptionLevel`. The composite key ensures that:
- Records with the same ClientId but different EngagementIds are treated as distinct.
- Records with the same EngagementId but different ClientIds are treated as distinct.
- Only records where **both** ClientId AND EngagementId match are flagged as duplicates.

This prevents scenarios where legitimate distinct records are incorrectly collapsed or where true duplicates slip through single-key detection.

### Feature C — Concurrent Rules Configuration Editing

Implement a concurrency control mechanism that allows multiple users to safely work with rules configuration for the same or different applications without data loss or silent overwrites. The mechanism combines three layers:

1. **Optimistic Concurrency Control (OCC)** — A `ConfigVersion` (monotonic integer) column on `app.DenominatorFilterRules` (logically scoped per-application). Every PUT/save request must include the `ConfigVersion` the client loaded. If the version in the database no longer matches (another user saved between load and save), the server rejects the request with HTTP 409 Conflict and returns the current state.

2. **Advisory Edit Session (Soft Lock)** — When a user opens the rules configuration form in edit mode, the system registers a lightweight "edit session" record in `app.ConfigEditSessions` (ApplicationId, UserId, SessionStart, LastHeartbeat, RuleScope). Other users opening the same application's config see a non-blocking **advisory warning banner**: "⚠️ [User X] is currently editing this configuration (started at HH:MM). Your changes may conflict." Sessions expire after 5 minutes without a heartbeat (auto-cleanup on server side).

3. **Conflict Detection & Resolution UX** — When a 409 Conflict is received:
   - The UI presents a conflict resolution dialog showing: (a) the rules the user tried to save ("Your changes"), (b) the rules another user just saved ("Latest saved version"), and (c) who saved them and when.
   - Resolution options: **Reload & re-edit** (discard local, load latest), **Merge manually** (show diff, let user pick), or **Force-save** (administrator-only override that increments version and persists regardless).
   - The conflict dialog preserves the user's unsaved form state so no work is lost.

This approach applies to both denominator rules (`DenominatorFilterRules`) and numerator rules (`NumeratorFilterRules`) configuration forms — the mechanism is generic and scope-parameterized.

## :chart_with_upwards_trend: Business Value

- **Impact Preview**: Reduces risk of misconfiguration by allowing business owners to see consequences before committing rule changes. Decreases time-to-correct from "wait for next pipeline run" to "immediate inline feedback." Builds user trust in the self-service configuration paradigm.
- **Composite-Key Deduplication**: Improves data accuracy by eliminating false positives and false negatives in duplicate detection. Prevents adoption metric inflation from repeated payloads while preserving legitimate distinct records that share a single key component.
- **Concurrency Control**: Prevents silent data loss when two users edit the same application's rules simultaneously. Advisory locking reduces friction by informing users proactively, while optimistic concurrency ensures data consistency without blocking. Conflict resolution UX preserves user work and avoids frustration.

## :white_check_mark: Acceptance Criteria

### Impact Preview (Option D)
- [ ] `POST /api/filters/denominator/:appId/preview` endpoint returns `Content-Type: text/event-stream` (SSE) and streams status/completion events.
- [ ] Preview response (via SSE `complete` event) includes full adoption metrics: `current { adoptionPct, revenueSharePct, matchedCount, denominatorCount, denominatorRevenue }`, `projected { ... }`, `delta { ... }`, `warnings[]`, `previewRunId`.
- [ ] Preview runs the **full existing pipeline** (`usp_ExecutePipelineRun`) with `@previewSessionId` parameter — same code path as production.
- [ ] Proposed rules are staged in `stage.DenominatorFilterRulesPreview` (session-scoped via `SessionId` GUID), then cleaned up after execution.
- [ ] Preview executes against the local denominator snapshot (`app.vw_DenominatorLocal`), never against the external Mercury server.
- [ ] Dynamic SQL is built from `DenominatorModels.SourceColumn` mapping (model-driven), not hardcoded column references.
- [ ] Revenue column is determined from `AdoptionSettings.RevenueMetric` for the target application.
- [ ] Rules are AND-combined (consistent with A13).
- [ ] UI shows side-by-side comparison of all adoption metrics with delta highlighting and warnings.
- [ ] `application_owner` and `administrator` roles can invoke preview; `viewer` role returns 403.
- [ ] Preview pipeline execution completes within 5 seconds for typical volumes (< 50K denominator rows, < 50K numerator rows).
- [ ] Preview runs are tagged `TriggerSource = 'Preview'` and excluded from dashboard metric queries.
- [ ] No concurrency guard for preview — multiple concurrent previews for the same application are allowed (session-isolated).
- [ ] Stale production pipeline runs (> 30 minutes in Queued/Processing) are auto-failed to prevent permanent blocking.
- [ ] Orphaned staged rules are purged by `ExpiresAt` TTL (1 hour) + SQL Agent cleanup job.

### Composite-Key Deduplication
- [ ] Pipeline deduplication uses `ClientId + EngagementId` as a composite key for `ROW_NUMBER() OVER (PARTITION BY ...)` deduplication logic.
- [ ] Records with identical `ClientId` AND `EngagementId` are flagged as duplicates (keeping latest by stage record ordering).
- [ ] Records sharing only `ClientId` or only `EngagementId` (but not both) are treated as distinct.
- [ ] `PipelineRuns.DuplicateCount` accurately reflects composite-key duplicates.
- [ ] `ValidationResults` records flagged as duplicate reference the composite key.
- [ ] Existing `AdoptionLevel`-based matching (Step 5) remains unchanged — only deduplication (Step 3) adopts the composite key.
- [ ] Stored procedure `usp_ExecutePipelineRun` updated with composite-key `PARTITION BY`.
- [ ] Unit/integration tests validate composite-key deduplication scenarios (same client different engagement, same engagement different client, full duplicate).

### Concurrent Rules Editing
- [ ] `ConfigVersion` (INT, NOT NULL, DEFAULT 1) column added to `app.DenominatorFilterRules` and `app.NumeratorFilterRules` — incremented atomically on every successful save per ApplicationId.
- [ ] `app.ConfigEditSessions` table created (SessionId, ApplicationId, RuleScope, UserId, SessionStart, LastHeartbeat, IsActive).
- [ ] `PUT /api/filters/denominator/:appId` and `PUT /api/filters/numerator/:appId` require `If-Match` header (or body `configVersion` field) — reject with 409 if version mismatch.
- [ ] 409 Conflict response includes: `currentVersion`, `currentRules`, `lastModifiedBy`, `lastModifiedAt` for client-side diff rendering.
- [ ] `POST /api/filters/:scope/:appId/edit-session` registers an advisory edit session; `DELETE` releases it; heartbeat via `PATCH` every 60 seconds.
- [ ] `GET /api/filters/:scope/:appId` response includes `activeEditors` array (userId, displayName, sessionStart) when other users have active sessions.
- [ ] Advisory warning banner displayed in UI when other editors are active — non-blocking, informational only.
- [ ] Conflict resolution dialog preserves user's unsaved form state and offers: Reload, Merge, or Force-save (admin-only).
- [ ] Stale edit sessions (no heartbeat > 5 minutes) are automatically cleaned up by a background sweep (server-side scheduled task or on-access cleanup).
- [ ] Force-save option restricted to `administrator` role; audit-logged with override reason.
- [ ] Concurrency mechanism is generic — works for both denominator and numerator rule scopes via `RuleScope` parameter.

## :link: Dependencies

- EPIC-BQM-001 (Database Foundation — base schema, `Applications`, `DenominatorModels`, `AdoptionSettings`)
- EPIC-BQM-008 (Denominator Rules Configuration — `DenominatorFilterRules` table, rule CRUD API)
- EPIC-BQM-004 (Numerator Filter Configuration — `NumeratorFilterRules` table, rule CRUD API — for concurrency on numerator rules)
- EPIC-BQM-006 (Validation Processing Pipeline — `usp_ExecutePipelineRun`, `PipelineRuns`, `ValidationResults`)
- EPIC-BQM-003 (Numerator Ingestion API — `stage.EngagementUsageRaw` data availability)
- EPIC-BQM-005 (Authentication & Authorization — role enforcement for force-save)
- EPIC-BQM-010 (CI Pipeline — baseline CI merged before source-code tasks)

## :classical_building: Architecture & Design Notes

- `Documentation/ProjectSpecifications/architecture.md` v1.5.0 — Section 4.8 (Impact Preview — Option D: staged rules, SSE delivery, ADF execution, stale run recovery, scale path)
- `Documentation/ProjectSpecifications/architecture.md` v1.4.0 — Section 4.7 (Concurrency Control for Rules Configuration)
- `Documentation/ProjectSpecifications/architecture.md` v1.3.0 — Section 4.3 (External View & Local Snapshot; `app.vw_DenominatorLocal`), Section 4.4 (ADF Pipeline Step 3 deduplication via `ROW_NUMBER`), Denominator Model Metadata (Shared)
- `Documentation/ProjectSpecifications/assumptions.md` — A12 (Shared Denominator Model), A13 (AND-Combined Rules), A18 (SP Over Data Flows), A25 (External Denominator Database), A37 (Optimistic Concurrency), A39 (Option D — Full Pipeline Preview), A40 (SSE Result Delivery), A41 (ADF Direct Call for MVP), A42 (No Preview Concurrency Guard), A43 (Stale Run Recovery 30min)
- `specs/012-impact-preview-dedup-concurrency/preview-options-comparison.md` — Full evaluation of Options A–D, async execution strategy, SSE deep dive, scale path
- `Documentation/StakeholderDocuments/AUTOMATED_SOLUTION_ARCHITECTURE.md` — "Denominator Preview: 2,909 engagements | $162.05M revenue"
- `Documentation/StakeholderDocuments/BUSINESS_RULES_AND_ETL_SUMMARY.md` — Section 1 Maestro: "Deduplicate by Client Id + Engagement Id combination"
- `database/stored-procedures/usp_ExecutePipelineRun.sql` — Current single-key `ROW_NUMBER() OVER (PARTITION BY ...)` logic (lines ~186–196)
- `.specify/memory/constitution.md` — Principle I (Data Integrity), Principle II (Configuration-Driven Business Rules)

## :clipboard: Scope

**In Scope:**
- Preview API endpoint (`POST /api/filters/denominator/:appId/preview`) with SSE streaming response
- Staged rules table (`stage.DenominatorFilterRulesPreview`) for session-scoped proposed rules
- SP modifications: `@previewSessionId` parameter on `usp_ExecutePipelineRun` and `usp_BuildFilteredDenominator` (~15 lines new SQL)
- Preview UI component (side-by-side comparison of full adoption metrics: adoption %, revenue share %, matched count, denominator count, denominator revenue)
- Async execution via existing `PipelineOrchestrationService` (ADF in production, local in development)
- Stale run recovery (30-minute threshold auto-fail for stuck production runs)
- Preview data retention (24h cleanup for preview-tagged `PipelineRuns`, `MetricSnapshots`, etc.)
- Staged rules TTL cleanup (SQL Agent job for `ExpiresAt` column)
- Composite-key deduplication in `usp_ExecutePipelineRun` (`PARTITION BY ClientId, EngagementId`)
- Updated `ValidationResults` duplicate-flagging to reference composite key
- `ConfigVersion` column on rules tables + optimistic concurrency enforcement on PUT endpoints
- `app.ConfigEditSessions` table for advisory edit session tracking
- Edit session API endpoints (register, heartbeat, release)
- Advisory warning banner UI when other editors are active
- Conflict resolution dialog (diff view, reload/merge/force-save options)
- Stale session cleanup mechanism
- Unit and integration tests for all three features
- CI quality gate compliance

**Out of Scope:**
- Denominator rule CRUD operations (already delivered in EPIC-BQM-008)
- Numerator impact preview (not requested; numerator filters have a different validation path)
- ADF pipeline structural changes (only SP parameter additions)
- Mercury view DDL changes (managed externally)
- Advanced drill-down into which specific records are added/removed by rule changes (potential future enhancement)
- Background worker / Azure Function for preview execution (deferred to scale phase — ADF direct call is sufficient for MVP)
- SignalR / WebSocket push notifications (SSE is sufficient; SignalR is the documented scale path for enterprise phase)
- Pessimistic database-level locking (advisory soft locks are sufficient for this user volume)
- Client-side polling hooks (SSE eliminates the need for polling)

## :book: Linked User Stories

- [ ] [BQM-US058] Denominator rules impact preview API
- [ ] [BQM-US059] Denominator rules impact preview UI component
- [ ] [BQM-US060] Composite-key numerator deduplication in pipeline
- [ ] [BQM-US061] Concurrent rules editing with optimistic concurrency and conflict resolution

## :white_check_mark: Definition of Done (DoD)

- [ ] All linked User Stories are closed.
- [ ] Integration testing completed for all three features.
- [ ] Architecture traceability verified (`Documentation/ProjectSpecifications/architecture.md` referenced).
- [ ] Pipeline regression tests pass with composite-key deduplication active.
- [ ] Preview endpoint validated against real denominator snapshot data.
- [ ] Concurrent editing scenario tested with two simultaneous sessions (conflict detection, resolution, advisory banner).

## :page_facing_up: PRD References

- `StakeholderDocuments/ApplicationGoals.md` — Phase 2: Denominator Rules Configuration (preview capability)
- `StakeholderDocuments/AUTOMATED_SOLUTION_ARCHITECTURE.md` — "Denominator Preview: 2,909 engagements | $162.05M revenue"; Denominator Rules Configuration mockup
- `StakeholderDocuments/BUSINESS_RULES_AND_ETL_SUMMARY.md` — Maestro section: "Deduplicate by Client Id + Engagement Id combination"
- `.specify/memory/constitution.md` — Principle I (Data Integrity), Principle II (Configuration-Driven Business Rules)
