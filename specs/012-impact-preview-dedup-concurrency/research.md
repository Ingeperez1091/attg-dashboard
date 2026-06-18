# Research: Impact Preview, Composite-Key Deduplication & Concurrent Rules Editing

**Feature Branch**: `012-impact-preview-dedup-concurrency`  
**Generated**: 2026-06-12  
**Updated**: 2026-06-14 — Added RT-011 through RT-016 (Option D async flow, SSE, stale recovery, scale path)  
**Status**: Complete

## Research Tasks & Findings

### RT-001: Preview API — Dynamic SQL Safety Pattern

**Context**: FR-003 requires dynamic SQL for preview built from `DenominatorModels.SourceColumn` mapping. FR-009 requires OWASP A03 injection prevention via metadata whitelist.

**Decision**: Use the existing pattern from `SqlDenominatorFilterRepository.previewImpact()` — column names are resolved exclusively from `app.DenominatorModels.SourceColumn` (seeded metadata), never from user input. The SP validates each column reference against the DenominatorModels table before constructing the WHERE clause.

**Rationale**: The project already implements this pattern for the existing preview endpoint. The `DenominatorModels` table acts as an allowlist — only columns registered there can appear in dynamic SQL predicates. User-supplied `denominatorModelId` values are resolved server-side to their `SourceColumn` via a JOIN, making SQL injection via column name manipulation impossible.

**Alternatives considered**:
- Parameterized-only queries (no dynamic SQL): Rejected because filter predicates require dynamic column references based on per-application rule configuration.
- String escaping of column names: Rejected — allowlist validation is more robust and aligns with existing code.

---

### RT-002: Composite-Key Deduplication — PARTITION BY Change Strategy

**Context**: FR-011 requires `ROW_NUMBER() OVER (PARTITION BY ClientId, EngagementId ...)` replacing the current single-key `PARTITION BY RecordKey` logic.

**Decision**: Modify the `parsed` CTE in `usp_ExecutePipelineRun.sql` to always extract both `clientId` and `engagementId` from the JSON payload, store them as separate columns, and use `PARTITION BY ClientId, EngagementId` regardless of `@isClientAdoption`. The `RecordKey` column remains (for matching in Step 5) based on `@isClientAdoption`, but deduplication uses the composite key.

**Rationale**: 
- The current code uses `RecordKey` (either clientId OR engagementId) for both dedup and matching. These are now decoupled: dedup uses composite key; matching retains adoption-level key.
- FR-017 explicitly states: "The existing `AdoptionLevel`-based matching key in pipeline Step 5 MUST remain unchanged."
- Extracting both fields adds minimal overhead (two `JSON_VALUE` calls already present in the JSON parsing step).

**Alternatives considered**:
- CONCAT-based composite key (`CONCAT(clientId, '|', engagementId)`): Rejected — prone to delimiter collision edge cases and less readable in error messages.
- Separate dedup SP: Rejected — adds unnecessary complexity; the change is localized to the `parsed` CTE within the existing SP.

---

### RT-003: Optimistic Concurrency — Separate Table vs. Column on Rules Table

**Context**: FR-019 requires ConfigVersion tracked per `(ApplicationId, RuleScope)`. The architecture doc (v1.4.0) already specifies `app.ConfigVersions` as a separate table.

**Decision**: Use a dedicated `app.ConfigVersions` table rather than adding a column to `DenominatorFilterRules` / `NumeratorFilterRules`.

**Rationale**:
- Rules tables store individual rule rows (many per application). A version column would require triggers or redundant updates across all rows to keep in sync.
- Separate table provides a single row per `(ApplicationId, RuleScope)` — simpler atomic update: `UPDATE ... SET Version = Version + 1 WHERE Version = @expected`.
- Already documented in `architecture.md` Section 4.7 and `story-061-concurrent-rules-editing.md`.
- Supports both `denominator` and `numerator` scopes without schema changes to either rules table.

**Alternatives considered**:
- Version column per rule row with trigger: Rejected — complex trigger logic, race conditions across multiple row updates.
- ETag-based (hash of rules JSON): Rejected — brittle to serialization order changes; version counter is more predictable and auditable.

---

### RT-004: Edit Session Lifecycle — Heartbeat vs. WebSocket

**Context**: FR-023 requires edit session lifecycle (register, heartbeat, release). FR-025 requires auto-expiry after 5 minutes without heartbeat.

**Decision**: Use HTTP-based heartbeat (PATCH every 60 seconds from client) with server-side stale session cleanup. No WebSockets.

**Rationale**:
- The application is a standard Next.js App Router deployment — no WebSocket infrastructure exists.
- < 20 concurrent users means heartbeat polling creates negligible load (1 PATCH/minute/editor).
- Server-side cleanup runs on-access (when querying active editors) with a `WHERE LastHeartbeat < DATEADD(MINUTE, -5, SYSUTCDATETIME())` filter.
- Matches the architecture documented in Section 4.7.

**Alternatives considered**:
- WebSocket-based presence: Rejected — requires additional infrastructure (Azure SignalR / WebSocket server), over-engineered for < 20 users.
- Server-Sent Events (SSE): Rejected — adds complexity without significant benefit at this scale.
- Shorter heartbeat (15s): Rejected — 60s provides sufficient liveness detection with 5-minute expiry, reduces network overhead.

---

### RT-005: Conflict Resolution — Force-Save Audit Pattern

**Context**: FR-027 requires force-save restricted to administrators and fully audit-logged with `ChangeType = 'ForceOverride'`.

**Decision**: Extend existing `app.RuleChangeAudit` table with two new columns: `ChangeType NVARCHAR(32)` (values: 'Update', 'ForceOverride') and `OverrideReason NVARCHAR(500)`. Force-save bypasses the version check but still increments the version.

**Rationale**:
- The `RuleChangeAudit` table already captures `ApplicationId`, `ActorUserId`, `PreviousRulesJson`, `NewRulesJson`, `ChangedAt`.
- Adding `ChangeType` and `OverrideReason` provides full governance traceability without a new table.
- Role enforcement happens at the API route handler layer (existing `requireAdminScope` guard), not in the SP.

**Alternatives considered**:
- Separate force-override audit table: Rejected — fragments audit trail, complicates queries.
- SP-level role enforcement: Rejected — roles are resolved via Azure AD token at the API layer; SP receives actor ID only.

---

### RT-006: Preview Response Enhancement — Revenue Metric Selection

**Context**: FR-004 requires revenue calculation to use `AdoptionSettings.RevenueMetric` (ETD or FYTD). The existing `previewRules()` in `DenominatorFilterService.ts` already resolves this.

**Decision**: No change needed to the service-level pattern. The existing implementation at lines 63–91 of `DenominatorFilterService.ts` already:
1. Loads `AdoptionSettings` for the application
2. Resolves `revenueMetric` (defaults to `ETD_ANSRAmt`)
3. Passes it to `previewImpact()` for SQL construction

**Rationale**: The preview API is already implemented and functional. This feature primarily needs integration testing and contract test coverage to validate the complete flow, plus UI component development (US-006).

**Alternatives considered**: N/A — pattern already exists and works correctly.

---

### RT-007: NULL Key Handling in Deduplication

**Context**: FR-016 requires records with NULL/empty keys to be flagged as invalid rather than treated as duplicates.

**Decision**: Add explicit NULL/empty checks for BOTH `ClientId` AND `EngagementId` before the dedup step. Records with either key NULL or empty string are immediately classified as 'Invalid' with `ErrorMessage = 'Missing key field: ClientId|EngagementId is NULL or empty'`.

**Rationale**:
- SQL `ROW_NUMBER() OVER (PARTITION BY NULL, NULL)` would group all null-key records together, incorrectly treating them as duplicates of each other.
- Existing code already handles NULL `RecordKey` in the validation step (line ~270: `WHEN pn.RecordKey IS NULL OR LTRIM(RTRIM(pn.RecordKey)) = '' THEN 'Invalid'`), but this only checks the single-key `RecordKey`. With composite keys, we need to check both fields independently.
- Invalid records skip the dedup ranking entirely — they are inserted into ValidationResults with 'Invalid' status before dedup logic runs.

**Alternatives considered**:
- COALESCE nulls to a sentinel value: Rejected — would create false "duplicate" matches between unrelated null records.
- Allow null keys to participate in dedup then fail at validation: Rejected — spec explicitly requires null keys = invalid, not duplicate.

---

### RT-008: Transaction Isolation for Concurrent Preview and Pipeline

**Context**: Edge case "Pipeline run during preview" — preview reads current snapshot; concurrent pipeline writes must not affect read-only preview.

**Decision**: Preview queries use `READ COMMITTED SNAPSHOT ISOLATION` (RCSI), which is the default Azure SQL Database behavior. No explicit isolation level override needed.

**Rationale**:
- Azure SQL Database enables RCSI by default — readers never block writers and vice versa.
- Preview reads from `app.vw_DenominatorLocal` (a view over `stage.DenominatorSnapshot`). If a pipeline run is updating the snapshot concurrently, the preview sees the last committed version — consistent and non-blocking.
- No explicit `SET TRANSACTION ISOLATION LEVEL` required.

**Alternatives considered**:
- SNAPSHOT isolation with explicit BEGIN TRANSACTION: Rejected — unnecessary overhead; RCSI provides sufficient guarantees.
- NOLOCK hints: Rejected — dirty reads could show partially-written denominator data.

---

### RT-009: Migration Numbering Strategy

**Context**: The project has migrations numbered 001–023+. New migrations need sequential numbers.

**Decision**: Use the next available sequence numbers (024, 025, 026) for the three new migrations:
1. `024_create_config_versions.sql` — ConfigVersions table + seed rows for existing 5 applications × 2 scopes
2. `025_create_config_edit_sessions.sql` — ConfigEditSessions table
3. `026_alter_rule_change_audit_add_override.sql` — Add ChangeType and OverrideReason columns

**Rationale**: Follows existing convention (sequential integer prefix, snake_case name). Migrations are idempotent (`IF NOT EXISTS` / `IF OBJECT_ID IS NULL` guard pattern used throughout the project).

**Alternatives considered**: N/A — follows established project convention.

---

### RT-010: In-Memory Repository Pattern for Concurrency Testing

**Context**: Constitution Principle IV requires all tests run against in-memory repositories. New ConfigVersion and ConfigEditSession repos need test doubles.

**Decision**: Create `InMemoryConfigVersionRepository` and `InMemoryConfigEditSessionRepository` following the established pattern in `src/frontend/infrastructure/persistence/memory/` — Map-based storage keyed by composite identifier, with atomic operations simulating SQL transaction semantics.

**Rationale**: 
- Existing in-memory repos (e.g., `InMemoryDenominatorFilterRepository`) use this exact pattern.
- Optimistic concurrency test: simulate two service calls loading the same version, first saves (version increments), second fails with version mismatch error.
- Runtime selection via factory in `src/frontend/infrastructure/persistence/runtime/`.

**Alternatives considered**:
- Mock/stub libraries: Rejected — project convention is concrete in-memory implementations that follow the same interface, enabling integration-level testing without external dependencies.

---

### RT-011: Option D — Staged Rules Table + Existing Pipeline SP Reuse

**Context**: The spec requires full adoption metrics preview (not just count/revenue). Four implementation options were evaluated in `preview-options-comparison.md`.

**Decision**: Option D — Stage proposed rules in `stage.DenominatorFilterRulesPreview` (session-scoped), then invoke the existing production pipeline with `@previewSessionId` parameter. The pipeline reads rules from the staging table instead of committed rules when the parameter is non-NULL.

**Rationale**:
- Zero logic duplication — all 4 existing SPs reused as-is (`usp_ExecutePipelineRun` → `usp_BuildFilteredDenominator` → `usp_ApplyNumeratorFilters` → `usp_CalculateMetrics`)
- Preview results are *definitionally identical* to production (same code path)
- Only ~15 lines new SQL: one `IF/ELSE` branch in `usp_BuildFilteredDenominator`, one pass-through parameter in `usp_ExecutePipelineRun`
- Auto-inherits pipeline changes — when SPs evolve (new operators, metrics, dedup), preview inherits automatically
- Lowest dev cost (1 sprint) with highest confidence

**SP Changes**:
- `usp_ExecutePipelineRun`: Add `@previewSessionId UNIQUEIDENTIFIER = NULL`; pass through to `usp_BuildFilteredDenominator`
- `usp_BuildFilteredDenominator`: Add `@previewSessionId UNIQUEIDENTIFIER = NULL`; when non-NULL, read rules from `stage.DenominatorFilterRulesPreview WHERE SessionId = @previewSessionId` instead of `app.DenominatorFilterRules`

**Staging Table**: `stage.DenominatorFilterRulesPreview` with `SessionId` (GUID), `ExpiresAt` (1h TTL), FK to `app.DenominatorModels`, indexed on `(SessionId, ApplicationId)`.

---

### RT-012: Async Execution via Existing PipelineOrchestrationService

**Context**: Option D runs the full pipeline (3–15s). Too long for synchronous HTTP. Must be async.

**Decision**: Reuse existing `PipelineOrchestrationService.triggerForApplication()` with extended `TriggerPipelineInput` (add `"Preview"` triggerSource + `previewSessionId?: string`).

**Rationale**:
- Infrastructure already exists: `ADFPipelineClient` (ADF mode), `ValidationPipelineDbRepository.executeLocalPipeline()` (local mode)
- `resolveExecutionMode()` already handles ADF vs local switching
- Only additions: `"Preview"` in triggerSource union, optional `previewSessionId` in `TriggerPipelineInput`
- `ADFPipelineClient.triggerValidationPipeline()` includes `previewSessionId` in JSON body
- `executeLocalPipeline()` passes `@previewSessionId` to SP call
- Preview runs bypass the production concurrency guard (checked in route, not service)

**Alternatives considered**:
- Background Worker (Azure Function + Queue): Deferred to scale phase (50+ concurrent previews). Zero benefit at < 20 users.
- New dedicated service: Rejected — `PipelineOrchestrationService` already does exactly what's needed; extending it is cleaner.

---

### RT-013: SSE Streaming for Result Delivery

**Context**: Client needs to receive preview results asynchronously without polling.

**Decision**: `POST /api/filters/denominator/:appId/preview` returns `Content-Type: text/event-stream` via `ReadableStream`. Three event types: `status`, `complete`, `error`.

**Rationale**:
- Zero new Azure resources (no SignalR Service)
- Zero new npm packages (`ReadableStream` is native in Next.js App Router)
- Single HTTP transaction (open → stream events → close)
- No client-side polling logic or hook needed
- Headers: `X-Accel-Buffering: no`, `Cache-Control: no-cache`, `Connection: keep-alive`
- Connection lifetime: 3–15s only — well within proxy/load-balancer timeouts

**Implementation (local mode)**:
```typescript
const stream = new ReadableStream({
  async start(controller) {
    send("status", { stage: "processing" });
    await repository.executeLocalPipeline({ ...input, previewSessionId });
    const metrics = await metricsService.getRunMetricsSummary(runId);
    send("complete", { current, projected: metrics, delta, warnings });
    controller.close();
  }
});
```

**Implementation (ADF mode)**: Server-side polling loop inside the SSE stream — polls `PipelineRun` status every 1s until Completed/Failed, pushes status events to client.

---

### RT-014: Preview Concurrency — No Guard, Session-Isolated

**Context**: Should preview requests have a concurrency guard like production pipeline runs?

**Decision**: No. Preview runs bypass the production guard entirely.

**Rationale**:
- Each preview has a unique `SessionId` → scoped to its own staged rules in `stage.DenominatorFilterRulesPreview`
- Tagged `TriggerSource = 'Preview'` → excluded from dashboard queries and "latest run" lookups
- A guard would permanently block if a preview gets stuck (no recovery mechanism for non-destructive operations)
- Worst case (2–3 overlapping previews for same app): extra SP executions against the same snapshot — acceptable at < 20 users
- Self-cleaning: `ExpiresAt` TTL (1h) for staged rules; 24h retention for preview PipelineRuns

---

### RT-015: Stale Run Recovery (Production Guard)

**Context**: Existing production concurrency guard checks `latestRun.status IN ('Queued','Processing')`. If a run gets permanently stuck, it blocks all future runs forever.

**Decision**: Before returning 409, check run age. If > 30 minutes, auto-fail the stuck run and allow the new one.

**Rationale**:
- Normal execution: 3–8s; worst case: 15–60s; ADF timeout: 10min
- 30 minutes = 3× safety margin over ADF timeout
- Prevents permanent blocking from SP timeouts, ADF crashes, or network failures
- Defense-in-depth: SQL Agent job (every 15min) also auto-fails stuck runs in case app process crashes

**Implementation**:
```typescript
if (latestRun && ['Queued', 'Processing'].includes(latestRun.status)) {
  const ageMs = Date.now() - new Date(latestRun.createDate).getTime();
  if (ageMs > 30 * 60 * 1000) {
    await repository.updateRunStatus({ runId: latestRun.runId, status: 'Failed', errorMessage: 'Auto-failed: exceeded 30min threshold' });
  } else {
    throw new AppError(409, 'CONFLICT', 'Pipeline run already in progress');
  }
}
```

---

### RT-016: Scale Path — Architecture Future-Proofing

**Context**: MVP = 5 apps / < 20 users. ATTG can grow to 200+ apps with 100+ concurrent users.

**Decision**: Document a clear scale path that evolves execution backend only — client-facing SSE contract never changes.

| Phase | Execution | Result Delivery | Trigger |
|-------|-----------|-----------------|---------|
| **MVP** | ADF direct call / local fire-and-forget | SSE | 5 apps, < 20 users |
| **Growth** | Same ADF (retries handle volume) | Same SSE | 20–50 apps |
| **Scale** | Background worker (Azure Function + Queue) | Same SSE | 50+ concurrent previews; ADF contention |
| **Enterprise** | Worker + queue per region | SignalR (if proxy buffering) | 100+ concurrent, multi-region |

**Implementation enabler**: `PipelineOrchestrationService.resolveExecutionMode()` already abstracts the executor. Adding `"worker"` mode is a config change + new executor class — no API or service contract changes.

---

### RT-009 (Updated): Migration Numbering Strategy

**Context**: Current latest migration is 030. New feature needs multiple migrations.

**Decision**: Updated numbering (migrations 031–037) to reflect Option D additions:
1. `031_create_stage_denominator_filter_rules_preview.sql` — Staging table
2. `032_create_config_versions.sql` — ConfigVersions + seed
3. `033_create_config_edit_sessions.sql` — ConfigEditSessions
4. `034_alter_usp_execute_pipeline_run_preview_session.sql` — Add @previewSessionId param
5. `035_alter_usp_build_filtered_denominator_preview.sql` — Add @previewSessionId + IF/ELSE branch
6. `036_alter_usp_execute_pipeline_run_composite_dedup.sql` — Change ROW_NUMBER PARTITION BY
7. `037_alter_rule_change_audit_changetype.sql` — Add ChangeType + OverrideReason columns
