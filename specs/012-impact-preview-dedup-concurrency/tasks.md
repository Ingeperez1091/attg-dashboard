# Tasks: Impact Preview (Option D), Composite-Key Deduplication & Concurrent Rules Editing

**Input**: Design documents from `/specs/012-impact-preview-dedup-concurrency/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Included — Constitution Principle IV mandates test-first development. Unit, contract, integration, and e2e tests are specified.

**Organization**: Tasks grouped by user story (6 stories: P1×3, P2×3) to enable independent implementation and testing.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Exact file paths included in all descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database migrations — all new tables and SP alterations that unblock every user story.

- [x] T001 Create staging table migration in `database/migrations/031_create_stage_denominator_filter_rules_preview.sql` — stage.DenominatorFilterRulesPreview with indexes, FK to DenominatorModels, CHECK on Operator, ExpiresAt TTL
- [x] T002 Create config versions table migration in `database/migrations/032_create_config_versions.sql` — app.ConfigVersions with composite PK (ApplicationId, RuleScope); seed 1 row per (ApplicationId × 2 scopes) for all 5 apps
- [x] T003 [P] Create edit sessions table migration in `database/migrations/033_create_config_edit_sessions.sql` — app.ConfigEditSessions with indexes, filtered unique constraint on (ApplicationId, RuleScope, UserId) WHERE IsActive=1
- [x] T004 Create SP migration for preview session passthrough in `database/migrations/034_alter_usp_execute_pipeline_run_preview_session.sql` — add `@previewSessionId UNIQUEIDENTIFIER = NULL` param, pass to usp_BuildFilteredDenominator
- [x] T005 Create SP migration for preview rule source branch in `database/migrations/035_alter_usp_build_filtered_denominator_preview.sql` — add `@previewSessionId UNIQUEIDENTIFIER = NULL`; IF/ELSE to read from stage.DenominatorFilterRulesPreview when non-NULL
- [x] T006 [P] Create SP migration for composite-key dedup in `database/migrations/036_alter_usp_execute_pipeline_run_composite_dedup.sql` — change PARTITION BY to (ClientId, EngagementId); add NULL key validation
- [x] T007 [P] Create audit extension migration in `database/migrations/037_alter_rule_change_audit_changetype.sql` — add ChangeType NVARCHAR(32) DEFAULT 'Update', OverrideReason NVARCHAR(500) NULL; CHECK constraint; backfill existing rows
- [x] T008 [P] Create rollback scripts in `database/rollback/031_rollback.sql` through `database/rollback/037_rollback.sql`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Domain entities, repository interfaces, in-memory test doubles, SSE utility, and DTO extensions that ALL user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T009 [P] Create ConfigVersion domain entity in `src/frontend/core/domain/entities/ConfigVersion.ts` — RuleScope type, ConfigVersion interface per data-model.md
- [x] T010 [P] Create ConfigEditSession domain entity in `src/frontend/core/domain/entities/ConfigEditSession.ts` — ConfigEditSession + ActiveEditor interfaces per data-model.md
- [x] T011 [P] Create IDenominatorPreviewRepository interface in `src/frontend/core/domain/repositories/IDenominatorPreviewRepository.ts` — stageRules(), deleteBySessionId(), methods
- [x] T012 [P] Create IConfigVersionRepository interface in `src/frontend/core/domain/repositories/IConfigVersionRepository.ts` — getVersion(), incrementVersion(), getWithCurrentRules(), methods for both scopes
- [x] T013 [P] Create Zod preview request schema in `src/frontend/infrastructure/validation/previewRequestSchema.ts` — rules array (denominatorModelId, operator, value), strict validation per FR-010
- [x] T014 [P] Create SSE stream helper utility in `src/frontend/lib/sse/sseStreamHelper.ts` — ReadableStream encoder, event formatter (status/complete/error), proper headers (X-Accel-Buffering: no, Cache-Control: no-cache)
- [x] T015 [P] Create DenominatorPreviewMemoryRepository in `src/frontend/infrastructure/persistence/memory/DenominatorPreviewMemoryRepository.ts` — Map-based test double implementing IDenominatorPreviewRepository
- [x] T016 [P] Create ConfigVersionMemoryRepository in `src/frontend/infrastructure/persistence/memory/ConfigVersionMemoryRepository.ts` — Map-based test double implementing IConfigVersionRepository with atomic version increment simulation
- [x] T016a [P] Create ConfigEditSessionMemoryRepository in `src/frontend/infrastructure/persistence/memory/ConfigEditSessionMemoryRepository.ts` — Map-based test double implementing edit session register/heartbeat/release/getActiveEditors with stale-session expiry simulation
- [x] T017 Modify PipelineTriggerDto in `src/frontend/core/application/dto/pipeline/PipelineTriggerDto.ts` — add "Preview" to triggerSource union type, add optional `previewSessionId?: string` field
- [x] T018 Register new repositories in runtime factory in `src/frontend/infrastructure/persistence/runtime/repositories.ts` — add getRuntimeDenominatorPreviewRepository() and getRuntimeConfigVersionRepository() getters

**Checkpoint**: Foundation ready — all interfaces, entities, test doubles, and utilities available for user story implementation.

---

## Phase 3: User Story 1 — Denominator Rules Impact Preview API (Priority: P1) 🎯 MVP

**Goal**: Stage proposed denominator rules, trigger full pipeline asynchronously, stream results via SSE — zero logic duplication with production.

**Independent Test**: Submit proposed rules to POST /api/filters/denominator/:appId/preview → verify SSE stream delivers status events then complete event with correct current/projected/delta metrics.

### Tests for User Story 1

- [x] T019 [P] [US1] Unit test for SSE stream helper in `tests/unit/lib/sseStreamHelper.test.ts` — event encoding, stream lifecycle, error handling
- [x] T020 [P] [US1] Unit test for DenominatorPreviewService in `tests/unit/services/denominatorPreviewService.test.ts` — stage rules, trigger pipeline, read metrics, cleanup, error path
- [x] T021 [P] [US1] Contract test for preview SSE endpoint in `tests/contract/preview-sse-endpoint.test.ts` — verify event schema (status/complete/error), headers, auth (403 for viewer), 400 for bad input
- [x] T022 [US1] Integration test for full preview pipeline in `tests/integration/preview-full-pipeline.test.ts` — end-to-end with local SP execution, verify staged rules cleanup

### Implementation for User Story 1

- [x] T023 [US1] Create DenominatorPreviewDbRepository in `src/frontend/infrastructure/persistence/database/DenominatorPreviewDbRepository.ts` — INSERT staged rules with SessionId + ExpiresAt, DELETE by SessionId, parameterized SQL
- [x] T024 [US1] Create DenominatorPreviewService in `src/frontend/core/application/services/denominatorPreviewService.ts` — orchestrate: validate → stage → trigger → poll/await → read metrics → delta → warnings → cleanup
- [x] T025 [US1] Modify PipelineOrchestrationService in `src/frontend/core/application/services/pipelineOrchestrationService.ts` — accept optional previewSessionId, pass through to triggerForApplication(), bypass production concurrency guard when TriggerSource='Preview'
- [x] T026 [US1] Modify ADFPipelineClient in `src/frontend/infrastructure/clients/ADFPipelineClient.ts` — include previewSessionId in pipeline trigger JSON body
- [x] T027 [US1] Modify ValidationPipelineDbRepository in `src/frontend/infrastructure/persistence/database/ValidationPipelineDbRepository.ts` — pass @previewSessionId parameter to SP call in executeLocalPipeline()
- [x] T028 [US1] Rewrite preview route handler as SSE endpoint in `src/frontend/app/api/filters/denominator/[appId]/preview/route.ts` — auth check, Zod validation, return ReadableStream with text/event-stream, call DenominatorPreviewService, emit status/complete/error events

**Checkpoint**: Preview API functional end-to-end. Verify with `curl -N` against local dev server (see quickstart.md).

---

## Phase 4: User Story 2 — Composite-Key Numerator Deduplication (Priority: P1)

**Goal**: Deduplication uses ClientId + EngagementId composite key; NULL key records flagged invalid; DuplicateCount reflects composite detection.

**Independent Test**: Ingest a batch with true duplicates (same ClientId+EngagementId), distinct records (shared single key), and NULL-key records → verify DuplicateCount and ValidationResults outcomes.

### Tests for User Story 2

- [x] T029 [P] [US2] Integration test for composite dedup pipeline in `tests/integration/composite-dedup-pipeline.test.ts` — true duplicate, shared-single-key (distinct), NULL key (invalid), DuplicateCount accuracy

### Implementation for User Story 2

- [x] T030 [US2] SP implementation already covered by migration T006 (`036_alter_usp_execute_pipeline_run_composite_dedup.sql`) — definition of done: integration test T029 passes (composite PARTITION BY produces correct DuplicateCount, NULL keys flagged Invalid, error context includes both key fields in ValidationResults)

**Checkpoint**: Run existing pipeline integration tests + new composite dedup test — all pass with correct dedup behavior.

---

## Phase 5: User Story 3 — Optimistic Concurrency on Rules Save (Priority: P1)

**Goal**: PUT endpoints reject saves with stale configVersion (409 Conflict); version + rules persist atomically; 409 response includes current state for resolution.

**Independent Test**: Two sessions load same ConfigVersion; first saves (version increments); second attempts save with stale version → receives 409 with current state.

### Tests for User Story 3

- [x] T031 [P] [US3] Unit test for ConfigVersionService in `tests/unit/services/configVersionService.test.ts` — version check pass, version check fail (conflict), force-save bypass, atomic increment
- [x] T032 [P] [US3] Contract test for 409 Conflict in `tests/contract/concurrency-409.test.ts` — PUT with stale version → 409 payload shape, PUT with correct version → 200, missing configVersion → 400

### Implementation for User Story 3

- [x] T033 [US3] Create ConfigVersionDbRepository in `src/frontend/infrastructure/persistence/database/ConfigVersionDbRepository.ts` — getVersion(), incrementVersionAtomic() (UPDATE WHERE Version=@expected), getWithCurrentRules()
- [x] T034 [US3] Create ConfigVersionService in `src/frontend/core/application/services/configVersionService.ts` — checkAndIncrement(), forceIncrement(), conflict response builder
- [x] T035 [US3] Modify denominator PUT route in `src/frontend/app/api/filters/denominator/[appId]/route.ts` — require configVersion in body (Zod), call ConfigVersionService before persist, return 409 with currentVersion/currentRules/lastModifiedBy/lastModifiedAt on conflict
- [x] T036 [US3] Modify numerator PUT route in `src/frontend/app/api/filters/numerator/[appId]/route.ts` — same OCC enforcement pattern as denominator (parameterized by RuleScope per FR-029)
- [x] T037 [US3] Modify denominator/numerator GET routes to include `configVersion` and `activeEditors[]` in response envelope

**Checkpoint**: Save with stale version returns 409; save with correct version succeeds and increments. Verify with curl (see quickstart.md).

---

## Phase 6: User Story 4 — Advisory Edit Session Warning (Priority: P2)

**Goal**: Users see a warning when another editor is active on the same configuration; sessions auto-expire after 5 minutes without heartbeat.

**Independent Test**: User A opens edit mode (session registered) → User B's GET response includes `activeEditors` with User A → User A navigates away (session released) → User B's next response shows empty `activeEditors`.

### Tests for User Story 4

- [x] T038 [P] [US4] Contract test for edit session lifecycle in `tests/contract/filters/edit-session-lifecycle.contract.test.ts` — POST (register), PATCH (heartbeat), DELETE (release), 403 for viewer, 409 for duplicate session, stale expiry behavior

### Implementation for User Story 4

- [x] T039 [US4] Create ConfigEditSessionDbRepository in `src/frontend/infrastructure/persistence/database/ConfigEditSessionDbRepository.ts` — register(), heartbeat(), release(), getActiveEditors() with stale session cleanup (WHERE LastHeartbeat > DATEADD(MINUTE, -5, ...))
- [x] T040 [US4] Create edit-session route handler in `src/frontend/app/api/filters/[scope]/[appId]/edit-session/route.ts` — POST (register), PATCH (heartbeat), DELETE (release); auth enforcement per contract
- [x] T041 [US4] Wire activeEditors into existing GET filter routes — query ConfigEditSessionDbRepository.getActiveEditors(), exclude requesting user, include in response envelope (already added in T037)

**Checkpoint**: Edit session lifecycle works end-to-end. Register → heartbeat → release; stale sessions excluded from activeEditors response.

---

## Phase 7: User Story 5 — Conflict Resolution UX (Priority: P2)

**Goal**: When a 409 occurs, a conflict resolution dialog shows the user's changes vs. latest saved version with action buttons (Reload, Force-save for admin, Cancel).

**Independent Test**: Trigger 409 → dialog renders with diff view, "Your changes" vs "Latest saved" + all resolution actions visible per role.

### Tests for User Story 5

- [x] T042 [P] [US5] E2E test for concurrency conflict resolution in `tests/e2e/concurrency-conflict-resolution.spec.ts` — two sessions → concurrent save → 409 → conflict dialog → resolve (Playwright)

### Implementation for User Story 5

- [x] T043 [US5] Implement force-save path in ConfigVersionService + PUT routes — forceOverride: true, require administrator role (403 for app_owner), require overrideReason, audit-log with ChangeType='ForceOverride' in RuleChangeAudit
- [x] T044 [US5] Create conflict resolution dialog UI component — show "Your changes" summary, "Latest saved version" with who/when, visual diff of rules, action buttons: Reload & re-edit, Force-save (admin only), Cancel; preserve unsaved form state

**Checkpoint**: 409 triggers dialog; user can resolve without losing work; force-save requires admin + reason and is audit-logged.

---

## Phase 8: User Story 6 — Impact Preview UI Component (Priority: P2)

**Goal**: Side-by-side visual comparison of current vs. projected metrics (adoption %, revenue share %, matched count, denominator count, denominator revenue) with delta indicators and streaming progress.

**Independent Test**: Modify rules in form → click "Preview Impact" → component renders SSE progress → displays current/projected comparison panel with deltas and warnings.

### Tests for User Story 6

- [x] T045 [P] [US6] E2E test for preview impact flow in `tests/e2e/preview-impact-flow.spec.ts` — modify rules → click Preview → SSE stream → comparison panel renders (Playwright)

### Implementation for User Story 6

- [x] T046 [US6] Create Preview Impact UI component — SSE consumer hook, progress indicator with stage labels, current/projected comparison panel with 5 metric fields, delta indicators (▲/▼/same), empty denominator warning, >25% reduction warning, error state with retry, disabled when no changes
- [x] T047 [US6] Integrate preview component into denominator rules configuration form — wire to existing form state, enable/disable based on dirty state, pass proposed rules to API

**Checkpoint**: Full UI flow — modify rules, click Preview, see progress, see results with deltas. Verify with Playwright e2e test.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Stale run recovery, ADF pipeline config, e2e advisory test, final validation.

- [x] T048 [US3] Modify pipeline run route for stale recovery in `src/frontend/app/api/pipeline/run/route.ts` — auto-fail runs > 30min before returning 409 (FR-010a)
- [x] T049 [US3] Integration test for stale run recovery in `tests/integration/stale-run-recovery.test.ts` — run stuck > 30min is auto-failed, new run proceeds
- [x] T050 [P] Add previewSessionId parameter to ADF pipeline definition in `pipelines/metrics-processing/pipeline.json` — add parameter with default empty string
- [x] T051 [P] [US4] E2E test for edit session advisory banner in `tests/e2e/edit-session-advisory-banner.spec.ts` — open edit mode → second tab sees warning → release → banner disappears (Playwright)
- [x] T053 [P] Create 24-hour retention purge job for preview-tagged artifacts — SQL Agent job or scheduled process that deletes PipelineRuns, MetricSnapshots, MatchedRecords, ValidationResults, FilterRuleSnapshots WHERE TriggerSource='Preview' AND CreateDate < DATEADD(HOUR, -24, SYSUTCDATETIME()) (FR-008)
- [x] T054 [P] Create SQL Agent jobs for defense-in-depth cleanup — (a) every 15min: auto-fail PipelineRuns stuck > 30min in Queued/Processing (FR-010a), (b) every 15min: DELETE FROM stage.DenominatorFilterRulesPreview WHERE ExpiresAt < SYSUTCDATETIME() (FR-001d orphan TTL purge)
- [x] T055 [P] [US1] Performance validation test in `tests/integration/preview-performance.test.ts` — assert preview pipeline completes within 5s for representative MVP data volume (< 50K rows); timing assertion per SC-001/FR-007
- [x] T056 Run full quickstart.md validation — apply migrations, verify preview curl, verify concurrency curl, run all test suites (pnpm test + pnpm playwright test)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (migrations must exist for repo implementations to reference schema)
- **Phase 3 (US1 - Preview)**: Depends on Phase 2 completion
- **Phase 4 (US2 - Dedup)**: Depends on Phase 1 only (migration T006 is self-contained); can run in parallel with Phase 2/3
- **Phase 5 (US3 - OCC)**: Depends on Phase 2 completion
- **Phase 6 (US4 - Sessions)**: Depends on Phase 2 + Phase 5 (T037 adds activeEditors to GET response)
- **Phase 7 (US5 - Conflict UX)**: Depends on Phase 5 (409 response must be implemented)
- **Phase 8 (US6 - Preview UI)**: Depends on Phase 3 (preview API must be functional)
- **Phase 9 (Polish)**: Depends on Phases 3–8

### User Story Independence

| Story | Can Start After | Parallel With |
|-------|-----------------|---------------|
| US1 (Preview API) | Phase 2 | US2, US3 |
| US2 (Dedup) | Phase 1 | US1, US3, US4, US5, US6 |
| US3 (OCC) | Phase 2 | US1, US2 |
| US4 (Sessions) | Phase 5 | US6 |
| US5 (Conflict UX) | Phase 5 | US4, US6 |
| US6 (Preview UI) | Phase 3 | US4, US5 |

### Within Each User Story

1. Tests written FIRST (must FAIL before implementation — Constitution Principle IV)
2. Repository/infrastructure before services
3. Services before API routes
4. API routes before UI components
5. Story complete → checkpoint → next priority

---

## Parallel Opportunities

### Phase 1 (All migrations can run in parallel authoring — sequential apply):
```
T001, T002, T003, T006, T007, T008 — all [P], different files
T004 → T005 (sequential: T005 references param from T004)
```

### Phase 2 (Most foundational tasks in parallel):
```
T009, T010, T011, T012, T013, T014, T015, T016 — all [P], different files
T017 → T018 (T18 registers repos that depend on T11/T12 interfaces)
```

### Phase 3 (US1 tests in parallel, then sequential implementation):
```
T019, T020, T021 — all [P], different test files
T023 → T024 → T025 → T026 → T027 → T028 (sequential: each layer builds on prior)
```

### Cross-Story Parallelism (with 2+ developers):
```
Developer A: Phase 3 (US1 Preview) → Phase 8 (US6 Preview UI)
Developer B: Phase 4 (US2 Dedup) + Phase 5 (US3 OCC) → Phase 6 (US4) + Phase 7 (US5)
```

---

## Implementation Strategy

### MVP First (User Stories 1–3 Only — All P1)

1. Complete Phase 1: Database migrations (031–037)
2. Complete Phase 2: Foundational (entities, interfaces, test doubles, utilities)
3. Complete Phase 3: US1 — Preview API (SSE streaming, full pipeline)
4. Complete Phase 4: US2 — Composite-Key Deduplication (SP already modified in Phase 1)
5. Complete Phase 5: US3 — Optimistic Concurrency (409 Conflict on PUT)
6. **STOP and VALIDATE**: All P1 stories independently testable
7. Deploy MVP — core governance controls operational

### Incremental Delivery (P2 Stories)

8. Phase 6: US4 — Advisory Edit Sessions (reduces conflict frequency)
9. Phase 7: US5 — Conflict Resolution UX (completes 409 user experience)
10. Phase 8: US6 — Preview UI Component (visual metric comparison)
11. Phase 9: Polish — stale recovery, ADF config, e2e coverage
12. **Final validation**: Full quickstart.md verification

### Suggested MVP Scope

**User Stories 1, 2, 3** (all P1) deliver complete governance controls:
- Preview API with SSE streaming
- Correct composite-key deduplication
- Optimistic concurrency preventing silent overwrites

P2 stories (4, 5, 6) enhance UX but are not governance-blocking.
