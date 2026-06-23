# Feature Specification: Impact Preview, Composite-Key Deduplication & Concurrent Rules Editing

**Feature Branch**: `012-impact-preview-dedup-concurrency`  
**Created**: 2026-06-12  
**Updated**: 2026-06-14  
**Status**: Draft  
**Input**: User description: "Work on epic-017-impact-preview-and-numerator-deduplication — Option D: Staged Rules Table + Existing Pipeline SP Reuse, async flow with SSE, performance priority for >200 app scale"  
**Epic**: EPIC-BQM-017  
**Implementation Approach**: Option D (Staged Rules + Existing Pipeline SP Reuse) — see `specs/012-impact-preview-dedup-concurrency/preview-options-comparison.md`

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Denominator Rules Impact Preview API (Priority: P1)

As an application owner, I want to preview how my proposed denominator rule changes affect the full adoption metrics (adoption %, revenue share %, matched count, denominator count, denominator revenue) before saving, so that I can see the complete before/after impact and avoid accidental metric distortion.

**Why this priority**: Constitution Principle II mandates "Rule changes MUST preview their impact on denominator/numerator counts before being applied." This is a governance control that protects against misconfiguration impacting all downstream adoption metrics. Full metric preview (not just count) ensures users understand second-order effects (e.g., shrinking the denominator increases adoption % even if matched count stays the same).

**Independent Test**: Can be fully tested by submitting proposed rules to the preview endpoint and verifying the returned full metrics (current and projected) match expected values computed from known denominator snapshot + numerator data.

**Acceptance Scenarios**:

1. **Given** I am an `application_owner` for Maestro and I modify the EngagementServiceCode filter from IN('11420') to IN('11420','11421'), **When** I click "Preview Impact", **Then** the system stages my proposed rules, triggers the full pipeline asynchronously, and streams the result via SSE — showing adoption %, revenue share %, matched count, denominator count, and denominator revenue in a current/projected comparison — without persisting any changes to committed rules.
2. **Given** I submit proposed rules via `POST /api/filters/denominator/:appId/preview`, **When** the endpoint processes the request, **Then** it returns `Content-Type: text/event-stream` with status events followed by a `complete` event containing `current { adoptionPct, revenueSharePct, matchedCount, denominatorCount, denominatorRevenue }`, `projected { ... }`, `delta { ... }`, `warnings[]`, and `previewRunId`.
3. **Given** I am a `viewer`, **When** I attempt to call the preview endpoint, **Then** I receive HTTP 403 Forbidden.
4. **Given** the local denominator snapshot is empty (no data after filters), **When** preview runs, **Then** it returns zero counts with a descriptive warning via the SSE `complete` event rather than an error event.
5. **Given** typical data volumes (< 50K denominator rows, < 50K numerator rows), **When** the preview pipeline executes the full metrics calculation, **Then** the SSE stream delivers the complete result within 5 seconds of the initial request.
6. **Given** the proposed rules reduce the denominator by more than 25%, **When** preview returns, **Then** the SSE `complete` event includes a warning explaining that adoption % increases are due to a smaller denominator base.
7. **Given** the preview pipeline execution fails (SP timeout, ADF error), **When** the failure is detected, **Then** the SSE stream delivers an `error` event with a non-technical message, the staged rules are cleaned up, and the preview PipelineRun is marked as Failed.

---

### User Story 2 - Composite-Key Numerator Deduplication (Priority: P1)

As a data engineer, I want the numerator processing pipeline to detect duplicates using a composite key of `ClientId + EngagementId`, so that legitimate records sharing a single key component are preserved while true duplicates are correctly flagged and excluded from adoption calculations.

**Why this priority**: Constitution Principle I mandates data integrity — the current single-key deduplication can incorrectly collapse distinct records or miss true duplicates, directly inflating or deflating adoption metrics.

**Independent Test**: Can be fully tested by ingesting a batch containing records with (a) same ClientId + same EngagementId (true duplicate), (b) same ClientId + different EngagementId (distinct), (c) different ClientId + same EngagementId (distinct), and verifying the pipeline's DuplicateCount and ValidationResults match expected outcomes.

**Acceptance Scenarios**:

1. **Given** two numerator records with the same `ClientId` AND the same `EngagementId`, **When** the pipeline processes them, **Then** the earlier record is flagged as a duplicate and only the latest (by StageId DESC, ItemIndex DESC) is promoted.
2. **Given** two numerator records with the same `ClientId` but different `EngagementId` values, **When** the pipeline processes them, **Then** both records are treated as distinct.
3. **Given** two numerator records with the same `EngagementId` but different `ClientId` values, **When** the pipeline processes them, **Then** both records are treated as distinct.
4. **Given** a numerator record has a NULL or empty `ClientId` or `EngagementId`, **When** processed, **Then** it is flagged as invalid (missing key field) — not treated as a duplicate.
5. **Given** a batch with N records and D composite-key duplicates, **When** the pipeline completes, **Then** `PipelineRuns.DuplicateCount = D`.

---

### User Story 3 - Optimistic Concurrency on Rules Save (Priority: P1)

As an application owner, I want the system to reject my save if another user modified the same application's rules after I loaded them, so that concurrent edits never silently overwrite each other.

**Why this priority**: Without optimistic concurrency, the last-writer-wins problem causes silent data loss — a governance and data integrity violation (Constitution Principle I).

**Independent Test**: Can be tested by simulating two sessions loading the same ConfigVersion, having the first save (succeeds, version increments), then the second attempting to save with the stale version (receives 409 Conflict with current state).

**Acceptance Scenarios**:

1. **Given** I load denominator rules at `ConfigVersion = 5` and another user saves (version becomes 6), **When** I click "Save Configuration" with version 5 payload, **Then** the server rejects with HTTP 409 and returns `{ currentVersion: 6, currentRules, lastModifiedBy, lastModifiedAt }`.
2. **Given** I load rules at `ConfigVersion = 5` and no one else has saved, **When** I click "Save Configuration", **Then** the save succeeds, version increments to 6, and rules are persisted atomically.
3. **Given** the server returns 409, **When** the UI processes the response, **Then** my unsaved form state is preserved — no user data is lost.

---

### User Story 4 - Advisory Edit Session Warning (Priority: P2)

As an application owner, I want to see a warning when another user is currently editing the same application's rules, so that I can avoid potential conflicts proactively.

**Why this priority**: Reduces conflict frequency by informing users before they invest effort. Non-blocking — purely advisory — so it does not impede workflows.

**Independent Test**: Can be tested by having User A open edit mode (session registered), then verifying User B's GET response includes `activeEditors` and the UI renders the warning banner.

**Acceptance Scenarios**:

1. **Given** User A opens the rules form for Application X in edit mode, **When** User B opens the same application's rules form, **Then** User B sees a warning banner: "⚠️ [User A] is currently editing this configuration (started at HH:MM). Your changes may conflict."
2. **Given** User A navigates away (session released), **When** User B's next poll cycle runs (≤ 15 seconds), **Then** the warning banner disappears.
3. **Given** User A's browser crashes (no release sent), **When** 5 minutes pass without a heartbeat, **Then** the stale session is cleaned up and no longer shown.
4. **Given** I am a `viewer` (read-only), **When** I open the rules form, **Then** no edit session is registered and no warning is shown to other users.

---

### User Story 5 - Conflict Resolution UX (Priority: P2)

As an application owner, I want a conflict resolution dialog that shows my changes alongside the latest saved version when a 409 occurs, so that I can choose how to resolve the conflict without losing my work.

**Why this priority**: Builds on P1 (optimistic concurrency) to complete the user experience. Without this, a 409 error would be cryptic and require manual reload.

**Independent Test**: Can be tested by triggering a 409 response and verifying the conflict dialog renders the diff view with all resolution action buttons respecting role-based visibility.

**Acceptance Scenarios**:

1. **Given** I receive a 409 Conflict, **When** the conflict dialog opens, **Then** I see: (a) "Your changes" summary, (b) "Latest saved version" with who saved and when, (c) a visual diff of rules that changed.
2. **Given** I choose "Reload & re-edit", **When** applied, **Then** the form loads the latest saved version and I can re-apply my changes.
3. **Given** I choose "Force-save" and I am an `administrator`, **When** applied, **Then** my version is saved, version increments, and the force-override is audit-logged.
4. **Given** I choose "Force-save" and I am an `application_owner`, **Then** the "Force-save" option is not available (disabled/hidden).
5. **Given** I choose "Cancel", **When** applied, **Then** the dialog closes and my unsaved form state is preserved.

---

### User Story 6 - Impact Preview UI Component (Priority: P2)

As an application owner, I want to see a side-by-side visual comparison of current vs. projected full adoption metrics in the configuration UI, so that I can confirm the complete impact of my changes visually before committing.

**Why this priority**: Depends on P1 (preview API) and completes the user-facing experience. The API alone provides value for programmatic checks; the UI makes it accessible to business users by showing the full metric impact (adoption %, revenue share %, matched count, denominator count, denominator revenue) with clear before/after deltas.

**Independent Test**: Can be tested by modifying rules in the form, clicking "Preview Impact", and verifying the component renders current/projected metrics with delta indicators and correct formatting for all five metric fields.

**Acceptance Scenarios**:

1. **Given** I have modified denominator rules, **When** I click "Preview Impact", **Then** the UI opens an SSE connection to the preview endpoint and displays a progress indicator with streaming status events ("Queued...", "Processing...", "Calculating metrics...").
2. **Given** the SSE stream delivers the `complete` event, **When** the UI processes it, **Then** it displays a current/projected comparison panel showing: Adoption %, Revenue Share %, Matched Count, Denominator Count, and Denominator Revenue — each with delta indicators (▲/▼/same).
3. **Given** the proposed denominator count is zero, **When** displayed, **Then** a warning indicator shows: "Warning: Proposed rules result in an empty denominator for this application."
4. **Given** the proposed rules reduce the denominator by >25%, **When** displayed, **Then** a contextual warning explains: "Denominator reduced by X% — adoption % increases due to smaller base."
5. **Given** I have not modified any rules, **When** the form loads, **Then** the "Preview Impact" button is disabled.
6. **Given** the SSE stream delivers an `error` event (timeout, pipeline failure), **When** displayed, **Then** a non-technical error message with "Retry" option is shown and form state is preserved.
7. **Given** the preview pipeline is executing (SSE stream open), **When** waiting, **Then** the UI shows a progress indicator with stage information from status events and does not block other form interactions.

---

### Edge Cases

- **Empty denominator snapshot**: Preview returns zeros with descriptive context via SSE `complete` event; pipeline reports "empty denominator" status rather than division-by-zero.
- **NULL keys in numerator**: Records with NULL/empty `ClientId` or `EngagementId` are flagged as invalid (missing key), never as duplicate.
- **Concurrent preview calls**: Multiple preview requests for the same application operate independently (session-isolated via unique `SessionId` in staged rules). No concurrency guard — each runs the full pipeline on its own staged rules without colliding. At >50 concurrent previews (scale phase), backpressure is provided by the background worker queue.
- **SSE connection drop mid-preview**: Pipeline execution continues to completion regardless; staged rules are cleaned up by TTL (1 hour `ExpiresAt`). Client can retry with a fresh preview request. No orphaned locks.
- **Staged rules orphaned (API crash between INSERT and DELETE)**: `ExpiresAt` TTL column ensures rows are purged within 1 hour by SQL Agent cleanup job. Preview PipelineRuns with no completion are auto-failed by stale run recovery (30min threshold) for production guard only.
- **Stale production pipeline run blocking new triggers**: Production concurrency guard auto-fails runs stuck > 30 minutes, preventing permanent blocking from SP timeouts or ADF crashes. Preview runs are exempt from the guard entirely.
- **Preview data accumulation**: Preview-tagged artifacts (`PipelineRuns`, `MetricSnapshots`, `MatchedRecords`, `ValidationResults` with `TriggerSource = 'Preview'`) are purged by a 24-hour retention job. Dashboard queries filter by `TriggerSource != 'Preview'`.
- **ADF cold start latency**: ADF webhook-triggered pipelines have 2–5s instantiation delay. SSE streams a `status: queued` event immediately so the user sees progress. Total preview time = ADF cold start + SP execution (3–8s typical).
- **Proxy buffering of SSE**: `X-Accel-Buffering: no` header set on response. If corporate proxy/WAF still buffers (enterprise scale), documented scale path upgrades to SignalR.
- **Heartbeat network failure**: If heartbeat fails intermittently, edit session remains active for 5 minutes from last successful heartbeat. Client retries on next interval.
- **Browser crash without session release**: Server auto-cleans stale edit sessions (> 5 min without heartbeat).
- **Force-save by non-admin**: API enforces role check; returns 403 if non-administrator attempts force-save.
- **All editors leave mid-edit**: Warning banner auto-dismisses; no zombie session warnings persist.
- **Pipeline run during preview**: Preview uses its own `SessionId`-scoped staged rules and creates a separate PipelineRun. Production pipeline and preview pipeline can execute concurrently without interference (different rule sources, separate MetricSnapshots rows).
- **Large rule set in conflict dialog**: Diff view handles up to 50 rules per application without truncation or performance degradation.
- **Version counter overflow**: INT column supports ~2.1 billion increments — sufficient for the lifetime of the application at expected save frequency.
- **Scale (200+ apps)**: At 200+ apps with 500K+ rows, pipeline execution may reach 15s. SSE holds the connection open for the full duration. If ADF integration runtime concurrency becomes a bottleneck, documented scale path adds a background worker (Azure Function + Queue) behind the same SSE delivery contract.

## Requirements *(mandatory)*

### Functional Requirements

#### Impact Preview

- **FR-001**: System MUST provide a `POST /api/filters/denominator/:appId/preview` endpoint that accepts proposed rules as a JSON array and returns a **Server-Sent Events (SSE) stream** (`Content-Type: text/event-stream`) delivering status progress events followed by a terminal `complete` event containing full adoption metrics: `current { adoptionPct, revenueSharePct, matchedCount, denominatorCount, denominatorRevenue }`, `projected { ... }`, `delta { ... }`, `warnings[]`, and `previewRunId`.
- **FR-001a**: Preview MUST calculate **full adoption metrics** by running the **existing production pipeline** (`usp_ExecutePipelineRun` → `usp_BuildFilteredDenominator` → `usp_ApplyNumeratorFilters` → `usp_CalculateMetrics`) with an optional `@previewSessionId` parameter that redirects the rule source to `stage.DenominatorFilterRulesPreview`. This is **Option D** — zero logic duplication, guaranteed parity with production.
- **FR-001b**: "Current" metrics MUST be sourced from the most recent completed non-preview pipeline run for the application (read from `app.MetricSnapshots`). No re-computation needed for the current side.
- **FR-001c**: Preview MUST generate contextual warnings when proposed rules significantly alter the denominator (e.g., >25% reduction) to help users understand second-order metric effects.
- **FR-001d**: Preview endpoint MUST stage proposed rules in `stage.DenominatorFilterRulesPreview` (session-scoped via a generated `SessionId` GUID) before triggering the pipeline. Staged rules MUST be cleaned up (DELETE) after pipeline completion or failure. Orphaned rows are purged by TTL (`ExpiresAt` = 1 hour from creation).
- **FR-001e**: Preview MUST be **asynchronous** — the endpoint returns an SSE stream immediately and triggers pipeline execution via the existing `PipelineOrchestrationService` (ADF in production, local SP call in development). In local mode, the SSE connection is held open while the SP executes. In ADF mode, server-side polling inside the SSE stream delivers status updates until completion.
- **FR-001f**: Preview pipeline runs MUST bypass the production concurrency guard. Each preview is session-isolated (`SessionId`) and tagged `TriggerSource = 'Preview'` — multiple concurrent previews for the same application are allowed.
- **FR-001g**: The SSE stream MUST emit events in this schema: `event: status` (with `stage` and optional `pctComplete`), `event: complete` (with full metrics payload), or `event: error` (with `message` and `previewRunId`). The stream MUST close after the terminal event.
- **FR-002**: Preview MUST execute against the local denominator snapshot (`app.vw_DenominatorLocal`), never against the external Mercury server.
- **FR-003**: Dynamic SQL for preview MUST be built from `DenominatorModels.SourceColumn` mapping (model-driven column resolution), not hardcoded column references. The `usp_BuildFilteredDenominator` SP reads column names from `stage.DenominatorFilterRulesPreview JOIN app.DenominatorModels` when `@previewSessionId IS NOT NULL`.
- **FR-004**: Revenue calculation in preview MUST use the revenue column determined by `AdoptionSettings.RevenueMetric` (ETD or FYTD) for the target application.
- **FR-005**: Filter rules in preview MUST be AND-combined (consistent with assumption A13).
- **FR-006**: Preview MUST enforce role-based access: `application_owner` (for assigned apps) and `administrator` can invoke; `viewer` receives HTTP 403.
- **FR-007**: Preview pipeline MUST complete within 5 seconds for typical MVP volumes (< 50K denominator rows, < 50K numerator rows). For scale volumes (200+ apps, 500K+ rows), execution may take up to 15 seconds — SSE streaming ensures the user sees progress events throughout.
- **FR-008**: Preview pipeline run artifacts (PipelineRuns, MetricSnapshots, MatchedRecords, ValidationResults, FilterRuleSnapshots) MUST be tagged with `TriggerSource = 'Preview'` to distinguish them from production runs. Preview runs MUST NOT affect dashboard-facing metric queries. A 24-hour retention job MUST purge preview-tagged artifacts.
- **FR-009**: The existing `usp_BuildFilteredDenominator` SP MUST validate column names against the `DenominatorModels` metadata whitelist before constructing dynamic SQL, preventing injection (OWASP A03:2021). This applies equally to the preview path (`@previewSessionId IS NOT NULL`).
- **FR-010**: Preview request body MUST be validated with a strict schema (Zod) before processing; malformed input returns HTTP 400 with validation error details.
- **FR-010a**: The production pipeline concurrency guard MUST include **stale run recovery**: if the latest in-progress run (`Queued` or `Processing`) is older than 30 minutes, it is auto-failed (`Status = 'Failed'`, `ErrorMessage = 'Auto-failed: exceeded 30min threshold'`) before the new run proceeds. A SQL Agent cleanup job (every 15 minutes) provides defense-in-depth.
- **FR-010b**: The SSE response MUST include `X-Accel-Buffering: no`, `Cache-Control: no-cache`, and `Connection: keep-alive` headers to prevent proxy/CDN buffering of the event stream.

#### Composite-Key Deduplication

- **FR-011**: Pipeline deduplication MUST use `ClientId + EngagementId` as a composite key for `ROW_NUMBER() OVER (PARTITION BY ClientId, EngagementId ORDER BY StageId DESC, ItemIndex DESC)`.
- **FR-012**: Records with identical `ClientId` AND `EngagementId` MUST be flagged as duplicates, keeping only the latest by stage record ordering.
- **FR-013**: Records sharing only one key component (ClientId OR EngagementId, but not both) MUST be treated as distinct.
- **FR-014**: `PipelineRuns.DuplicateCount` MUST accurately reflect the count of composite-key duplicate records (extra occurrences beyond the first per key).
- **FR-015**: `ValidationResults` records flagged as duplicate MUST include the composite key in the error context (e.g., "Duplicate: ClientId=X, EngagementId=Y").
- **FR-016**: Records with NULL or empty `ClientId` or `EngagementId` MUST be flagged as invalid (missing key field) — never classified as duplicate.
- **FR-017**: The existing `AdoptionLevel`-based matching key in pipeline Step 7 (matching) MUST remain unchanged — only Step 4 (parse/dedup) adopts the composite key.
- **FR-018**: Raw source data in `stage.EngagementUsageRaw` MUST NOT be modified by the deduplication process (Constitution Principle I).

#### Concurrent Rules Editing

- **FR-019**: System MUST maintain a `ConfigVersion` (monotonic integer) per `(ApplicationId, RuleScope)` combination, tracked in `app.ConfigVersions`.
- **FR-020**: `PUT /api/filters/denominator/:appId` and `PUT /api/filters/numerator/:appId` MUST require the client's loaded `configVersion` and reject with HTTP 409 if the database version has advanced.
- **FR-021**: Version increment and rules persistence MUST occur within a single database transaction — atomic save-or-reject with no partial state.
- **FR-022**: 409 Conflict response MUST include: `currentVersion`, `currentRules`, `lastModifiedBy`, `lastModifiedAt` for client-side conflict resolution.
- **FR-023**: System MUST provide edit session lifecycle endpoints: register (`POST`), heartbeat (`PATCH`, every 60s from client), release (`DELETE`).
- **FR-024**: `GET /api/filters/:scope/:appId` MUST include `configVersion` and `activeEditors[]` array in its response when other users have active edit sessions.
- **FR-025**: Edit sessions MUST auto-expire after 5 minutes without a heartbeat. Stale sessions are cleaned up server-side (on-access or scheduled sweep).
- **FR-026**: Advisory warning banner MUST be non-blocking and informational only — it MUST NOT prevent saves.
- **FR-027**: Force-save MUST be restricted to `administrator` role and MUST be audit-logged in `app.RuleChangeAudit` with `ChangeType = 'ForceOverride'` and an override reason.
- **FR-028**: Conflict resolution dialog MUST preserve the user's unsaved form state and offer: Reload & re-edit, Force-save (admin only), Cancel.
- **FR-029**: The concurrency mechanism MUST be generic — parameterized by `RuleScope` to work for both denominator and numerator rules without code duplication.
- **FR-030**: Edit session registration MUST NOT occur for `viewer` role users (read-only access does not constitute editing).

### Key Entities

- **DenominatorFilterRulesPreview** (stage schema): Session-scoped transient staging table for proposed denominator rules during preview. Columns: PreviewId (PK), SessionId (GUID scoping rules to one preview), ApplicationId, DenominatorModelId (FK → DenominatorModels), Operator, Value, RuleOrder, CreateDate, ExpiresAt (TTL for orphan cleanup). Indexed on (SessionId, ApplicationId) and (ExpiresAt).
- **ConfigVersions**: Tracks per-application, per-scope rule configuration version (ApplicationId, RuleScope, Version, LastModifiedBy, LastModifiedAt).
- **ConfigEditSessions**: Tracks active editing sessions for advisory warnings (SessionId, ApplicationId, RuleScope, UserId, SessionStart, LastHeartbeat, IsActive).
- **DenominatorModels**: Shared metadata defining Mercury view column schema (DenominatorModelId, FieldName, SourceColumn, FieldType, IsFiltirable). Used by preview to build dynamic SQL safely — both production and preview paths join against this table for column resolution.
- **AdoptionSettings**: Per-application configuration that determines RevenueMetric (ETD/FYTD) used in preview revenue calculation.
- **PipelineRuns**: Pipeline execution tracking — extended with `TriggerSource = 'Preview'` tag for preview runs. Preview runs bypass production concurrency guard. DuplicateCount reflects composite-key detection.
- **MetricSnapshots**: Stores calculated metrics per pipeline run. Preview metrics are stored here (tagged via PipelineRun's TriggerSource) and purged after 24 hours.
- **ValidationResults**: Per-record validation outcome — extended to include composite-key error context for duplicate-flagged records.
- **RuleChangeAudit**: Audit log extended with `ChangeType` and `OverrideReason` for force-save governance.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Application owners can preview full adoption metrics (adoption %, revenue share %, matched count, denominator count, denominator revenue) with a current/projected comparison in under 5 seconds for all five applications.
- **SC-002**: Zero silent overwrites occur when two users edit the same application's rules concurrently — every conflict is detected and surfaced to the user.
- **SC-003**: Duplicate numerator records (same ClientId + EngagementId) are correctly identified and excluded from adoption metric calculations with 100% accuracy in regression tests.
- **SC-004**: Legitimate distinct records sharing only one key component (ClientId OR EngagementId) are never incorrectly flagged as duplicates.
- **SC-005**: Users presented with a 409 Conflict can resolve the situation (reload, merge, or force-save) without losing their unsaved work.
- **SC-006**: Advisory edit session warnings appear within 15 seconds of another editor opening the same configuration form.
- **SC-007**: Stale edit sessions are cleaned up within 6 minutes of the last heartbeat (5-minute expiry + 1-minute cleanup interval).
- **SC-008**: All preview, concurrency, and deduplication features pass CI quality gates (lint, type-check, unit/contract/integration tests) before merge.
- **SC-009**: Force-save override actions are 100% audit-logged with actor identity, timestamp, override reason, and overwritten version.
- **SC-010**: Preview endpoint correctly handles empty denominators, returning zeros with descriptive context rather than errors.

## Assumptions

- **Option D selected**: Preview runs the full existing pipeline (`usp_ExecutePipelineRun`) via a staged rules table (`stage.DenominatorFilterRulesPreview`) + `@previewSessionId` parameter — zero logic duplication, guaranteed parity with production output (assumption A39).
- **SSE for result delivery**: Preview results are delivered via Server-Sent Events — no client-side polling, no SignalR (assumption A40). The SSE connection is held open for the duration of pipeline execution (3–15s depending on volume).
- **ADF direct call for async execution (MVP)**: The existing `PipelineOrchestrationService` and `ADFPipelineClient` trigger the pipeline (ADF in production, local SP in development). No background worker for MVP — deferred to scale phase (assumption A41).
- **No concurrency guard for preview**: Preview runs bypass the production concurrency guard because they are session-isolated and non-destructive (assumption A42).
- **Stale run recovery**: Production pipeline guard auto-fails runs stuck > 30 minutes, preventing permanent blocking (assumption A43).
- **Scale path defined**: At 50+ concurrent previews (ADF contention), add background worker (Azure Function + Queue). At enterprise scale (proxy buffering), upgrade SSE to SignalR. Architecture evolves execution backend only — client-facing SSE contract never changes.
- The local denominator snapshot (`stage.DenominatorSnapshot` / `app.vw_DenominatorLocal`) is sufficiently fresh for meaningful preview results. Preview reflects the data from the last successful `PL_DenomLoad_Weekly` run (assumption A36).
- The expected concurrent editor count is low (< 5 users editing rules at any given time). Optimistic concurrency with advisory sessions is sufficient without pessimistic locking (assumption A37).
- The Mercury view schema (~17 columns defined in `DenominatorModels`) is stable and already seeded. No new model columns are introduced by this feature.
- Denominator filter rules are AND-combined (assumption A13). No OR-grouping or complex boolean logic is required.
- The existing `PUT /api/filters/denominator/:appId` and `PUT /api/filters/numerator/:appId` endpoints from EPIC-BQM-008 and EPIC-BQM-004 are operational and will be modified (not replaced) to include version enforcement.
- Numerator JSON payloads contain both `$.clientId` and `$.engagementId` fields extractable via `JSON_VALUE`. Applications that are engagement-level still include clientId in their payload structure.
- The composite deduplication key change does not affect the downstream AdoptionLevel-based matching key (Step 5), which remains EngagementId for engagement-level apps and ClientId for client-level apps.
- Force-save is a governance exception, not a standard workflow. It requires administrator role and an explicit override reason.
- The CI baseline pipeline (EPIC-BQM-010) is already merged to trunk. Feature work can proceed with confidence that quality gates are enforced on PRs.
- The `app.RuleChangeAudit` table (from EPIC-BQM-008) already exists and will be extended with `ChangeType` and `OverrideReason` columns.
- SP modifications for Option D are minimal (~15 lines new SQL): one `IF/ELSE` branch in `usp_BuildFilteredDenominator` and one pass-through parameter in `usp_ExecutePipelineRun`. All other pipeline SPs remain unchanged.
- Preview artifacts (PipelineRuns, MetricSnapshots, MatchedRecords, ValidationResults, FilterRuleSnapshots tagged `TriggerSource = 'Preview'`) are transient and subject to 24-hour retention purge.
- The `PipelineOrchestrationService` already abstracts execution mode behind `resolveExecutionMode()`. Adding a future third mode (`"worker"`) requires no client-facing or API changes — the architecture is designed for this evolution.
- At MVP scale (5 apps, < 20 users), ADF direct call and SSE are sufficient. Performance targets: < 5s for typical volumes, < 15s for scale volumes (200+ apps, 500K+ rows).
