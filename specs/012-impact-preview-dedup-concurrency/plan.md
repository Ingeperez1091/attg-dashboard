# Implementation Plan: Impact Preview (Option D), Composite-Key Deduplication & Concurrent Rules Editing

**Branch**: `012-impact-preview-dedup-concurrency` | **Date**: 2026-06-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/012-impact-preview-dedup-concurrency/spec.md`
**Design Reference**: [preview-options-comparison.md](./preview-options-comparison.md)

## Summary

Implement three cohesive data-quality features on the existing Next.js 15 + Azure SQL + ADF pipeline architecture:

1. **Impact Preview (Option D)** — Stage proposed denominator rules in `stage.DenominatorFilterRulesPreview`, invoke the existing production pipeline (`usp_ExecutePipelineRun`) with a `@previewSessionId` parameter, and stream results via SSE. Zero logic duplication; guaranteed parity with production metrics.
2. **Composite-Key Deduplication** — Change pipeline Step 4 (parse/dedup) from single-key (`PARTITION BY RecordKey`) to composite-key (`PARTITION BY ClientId, EngagementId`).
3. **Concurrent Rules Editing** — Add `ConfigVersions` table, optimistic concurrency enforcement on PUT endpoints (409 Conflict), advisory edit sessions, and conflict resolution UI.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 24.x (Next.js 15 App Router); T-SQL (Azure SQL Database, SQL Server 2022-compatible)  
**Primary Dependencies**: Next.js 15, React 18, Zod, mssql (parameterized SQL), Motif web components, existing auth/session abstractions  
**Storage**: Azure SQL Database (`app` + `stage` schemas); in-memory repositories for deterministic tests  
**Testing**: Vitest (unit + contract + integration); Playwright (e2e); in-memory repository isolation  
**Target Platform**: Azure App Service (Windows IIS); Azure Data Factory (pipeline execution)  
**Project Type**: Web application (Next.js App Router — API routes + React UI)  
**Performance Goals**: Preview < 5s (MVP, 50K rows); < 15s (scale, 500K rows); SSE streaming for non-blocking UX  
**Constraints**: No new Azure resources for MVP; no SignalR/WebSocket; no background worker until scale phase; < 30s proxy timeout  
**Scale/Scope**: 5 apps MVP → 200+ apps ATTG environment; < 20 concurrent users MVP → 100+ scale

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Justification |
|-----------|--------|---------------|
| **I. Data Integrity First** | ✅ PASS | Raw source data untouched; preview artifacts tagged and purged; composite-key preserves correct records; version control prevents silent overwrites |
| **II. Configuration-Driven Rules** | ✅ PASS | Option D runs production pipeline with staged config rules; preview directly implements "MUST preview impact before applying" mandate |
| **III. Validated Data Ingestion** | ✅ PASS | Composite-key dedup improves ingestion accuracy; no change to existing validation flow |
| **IV. Test-First Development** | ✅ PASS | In-memory repositories + Vitest; deterministic test isolation; no external DB needed for unit/contract tests |
| **V. Security & RBAC** | ✅ PASS | Role enforcement (`application_owner`/`administrator`); Zod validation; parameterized SQL via `sp_executesql`; DenominatorModels whitelist prevents injection; SSRF protection on ADF calls; force-save audit-logged |
| **V.A03 Injection** | ✅ PASS | Preview reuses existing `usp_BuildFilteredDenominator` which validates columns against DenominatorModels whitelist before dynamic SQL; `sp_executesql` with typed parameters |
| **V.A04 Insecure Design** | ✅ PASS | Preview is session-isolated, non-destructive; 24h retention purge; stale run recovery; rate limiting via existing middleware |
| **V.A09 Logging** | ✅ PASS | Pipeline runs audited in PipelineRuns table; force-save logged in RuleChangeAudit; edit sessions tracked |

## Project Structure

### Documentation (this feature)

```text
specs/012-impact-preview-dedup-concurrency/
├── plan.md              # This file
├── spec.md              # Feature specification
├── preview-options-comparison.md  # Design analysis (Options A–D)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── preview-api.md
│   ├── rules-concurrency-api.md
│   └── edit-session-api.md
└── checklists/
    └── requirements.md  # Quality checklist
```

### Source Code (repository root)

```text
src/frontend/
├── app/api/
│   ├── filters/denominator/[appId]/
│   │   ├── route.ts                    # MODIFY: Add configVersion to GET, enforce OCC on PUT
│   │   └── preview/route.ts            # REWRITE: SSE streaming endpoint (Option D flow)
│   ├── filters/numerator/[appId]/
│   │   └── route.ts                    # MODIFY: Add configVersion to GET, enforce OCC on PUT
│   ├── filters/[scope]/[appId]/
│   │   └── edit-session/route.ts       # NEW: POST/PATCH/DELETE edit session lifecycle
│   └── pipeline/run/route.ts           # MODIFY: Add stale run recovery to conflict guard
├── core/
│   ├── application/
│   │   ├── dto/pipeline/
│   │   │   └── PipelineTriggerDto.ts   # MODIFY: Add "Preview" to triggerSource union + previewSessionId
│   │   └── services/
│   │       ├── pipelineOrchestrationService.ts  # MODIFY: Accept previewSessionId passthrough
│   │       ├── denominatorPreviewService.ts     # NEW: Stage rules, orchestrate SSE flow, cleanup
│   │       └── configVersionService.ts          # NEW: OCC check + version increment
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── ConfigVersion.ts                 # NEW
│   │   │   └── ConfigEditSession.ts             # NEW
│   │   └── repositories/
│   │       ├── IDenominatorPreviewRepository.ts  # NEW: stage/delete preview rules
│   │       └── IConfigVersionRepository.ts       # NEW: version CRUD + OCC check
│   └── ...
├── infrastructure/
│   ├── clients/ADFPipelineClient.ts    # MODIFY: Include previewSessionId in body
│   ├── persistence/
│   │   ├── database/
│   │   │   ├── ValidationPipelineDbRepository.ts    # MODIFY: Pass @previewSessionId to SP
│   │   │   ├── DenominatorPreviewDbRepository.ts    # NEW
│   │   │   └── ConfigVersionDbRepository.ts         # NEW
│   │   ├── memory/
│   │   │   ├── DenominatorPreviewMemoryRepository.ts # NEW (test)
│   │   │   └── ConfigVersionMemoryRepository.ts      # NEW (test)
│   │   └── runtime/repositories.ts                   # MODIFY: Add new repo getters
│   └── validation/
│       └── previewRequestSchema.ts      # NEW: Zod schema for preview body
└── lib/
    └── sse/sseStreamHelper.ts           # NEW: ReadableStream + event encoder utility

database/
├── migrations/
│   ├── 031_create_stage_denominator_filter_rules_preview.sql   # NEW
│   ├── 032_create_config_versions.sql                          # NEW
│   ├── 033_create_config_edit_sessions.sql                     # NEW
│   ├── 034_alter_usp_execute_pipeline_run_preview_session.sql  # MODIFY SP
│   ├── 035_alter_usp_build_filtered_denominator_preview.sql    # MODIFY SP
│   ├── 036_alter_usp_execute_pipeline_run_composite_dedup.sql  # MODIFY SP (dedup)
│   └── 037_alter_rule_change_audit_changetype.sql              # MODIFY table
├── stored-procedures/
│   ├── usp_ExecutePipelineRun.sql       # Reference (modify via migration)
│   └── usp_BuildFilteredDenominator.sql # Reference (modify via migration)
└── rollback/
    ├── 031_rollback.sql
    ├── 032_rollback.sql
    ├── 033_rollback.sql
    ├── 034_rollback.sql
    ├── 035_rollback.sql
    ├── 036_rollback.sql
    └── 037_rollback.sql

tests/
├── unit/
│   ├── services/denominatorPreviewService.test.ts    # NEW
│   ├── services/configVersionService.test.ts         # NEW
│   └── lib/sseStreamHelper.test.ts                   # NEW
├── contract/
│   ├── preview-sse-endpoint.test.ts                  # NEW
│   ├── concurrency-409.test.ts                       # NEW
│   └── edit-session-lifecycle.test.ts                # NEW
├── integration/
│   ├── preview-full-pipeline.test.ts                 # NEW
│   ├── composite-dedup-pipeline.test.ts              # NEW
│   └── stale-run-recovery.test.ts                    # NEW
└── e2e/
    ├── preview-impact-flow.spec.ts                   # NEW: Full UI flow — modify rules → click Preview → SSE stream → comparison panel renders
    ├── concurrency-conflict-resolution.spec.ts       # NEW: Two sessions → concurrent save → 409 → conflict dialog → resolve
    └── edit-session-advisory-banner.spec.ts          # NEW: Open edit mode → second tab sees warning → release → banner disappears

pipelines/
└── metrics-processing/
    └── pipeline.json    # MODIFY: Add previewSessionId parameter with default ""
```

**Structure Decision**: Follows existing Clean Architecture layers (domain → application → infrastructure → app routes). New services follow existing patterns (`PipelineOrchestrationService` → `DenominatorPreviewService`). Database changes via idempotent numbered migrations.

## Complexity Tracking

> No constitution violations — no complexity justification needed.
