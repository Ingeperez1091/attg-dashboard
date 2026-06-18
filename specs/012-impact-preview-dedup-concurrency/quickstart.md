# Quickstart: Impact Preview (Option D + SSE), Composite-Key Deduplication & Concurrent Rules Editing

**Feature Branch**: `012-impact-preview-dedup-concurrency`  
**Updated**: 2026-06-14

## Prerequisites

- Node.js 24.x
- Azure SQL Database access (connection string in env)
- Database migrations 001–030 already applied
- pnpm / npm available
- `PIPELINE_EXECUTION_MODE=local` in `.env.local` for local development (no ADF needed)

## Setup

```bash
# 1. Switch to feature branch
git checkout 012-impact-preview-dedup-concurrency

# 2. Install dependencies
pnpm install

# 3. Apply new database migrations (031–037)
sqlcmd -S <server> -d <database> -i database/migrations/031_create_stage_denominator_filter_rules_preview.sql
sqlcmd -S <server> -d <database> -i database/migrations/032_create_config_versions.sql
sqlcmd -S <server> -d <database> -i database/migrations/033_create_config_edit_sessions.sql
sqlcmd -S <server> -d <database> -i database/migrations/034_alter_usp_execute_pipeline_run_preview_session.sql
sqlcmd -S <server> -d <database> -i database/migrations/035_alter_usp_build_filtered_denominator_preview.sql
sqlcmd -S <server> -d <database> -i database/migrations/036_alter_usp_execute_pipeline_run_composite_dedup.sql
sqlcmd -S <server> -d <database> -i database/migrations/037_alter_rule_change_audit_changetype.sql

# 4. Run development server
pnpm dev
```

## Verify Preview API (SSE Stream)

```bash
# POST returns text/event-stream — use curl with streaming:
curl -N -X POST http://localhost:3000/api/filters/denominator/{appId}/preview \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "rules": [
      {
        "denominatorModelId": "<valid-model-id>",
        "operator": "IN_LIST",
        "value": "11420;11421"
      }
    ]
  }'
```

Expected SSE stream output:
```
event: status
data: {"stage":"processing","pctComplete":0,"previewRunId":"a1b2c3d4-..."}

event: status
data: {"stage":"calculating_metrics","pctComplete":75}

event: complete
data: {"current":{"adoptionPct":42.3,"revenueSharePct":38.1,"matchedCount":1247,"denominatorCount":2948,"denominatorRevenue":48200000.00},"projected":{"adoptionPct":58.7,"revenueSharePct":51.2,"matchedCount":1247,"denominatorCount":2124,"denominatorRevenue":34700000.00},"delta":{"adoptionPct":16.4,"revenueSharePct":13.1,"matchedCount":0,"denominatorCount":-824,"denominatorRevenue":-13500000.00},"warnings":["Denominator reduced by 28% — adoption % increases due to smaller base"],"previewRunId":"a1b2c3d4-...","calculatedAtUtc":"2026-06-14T14:30:00.000Z"}
```

## Verify Concurrency (after implementation)

```bash
# GET rules with configVersion
curl http://localhost:3000/api/filters/denominator/{appId} \
  -H "Authorization: Bearer <token>"
# Response includes: "configVersion": 1, "activeEditors": []

# PUT with correct version (succeeds)
curl -X PUT http://localhost:3000/api/filters/denominator/{appId} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "rules": [...],
    "configVersion": 1
  }'

# PUT with stale version (409)
curl -X PUT http://localhost:3000/api/filters/denominator/{appId} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "rules": [...],
    "configVersion": 1
  }'
# Returns 409 with { currentVersion: 2, currentRules, lastModifiedBy, lastModifiedAt }
```

## Run Tests

```bash
# Unit tests (in-memory repos, no DB required)
pnpm vitest run tests/unit/

# Contract tests (auto-bootstrapped test server on :3110)
pnpm vitest run tests/contract/

# Integration tests
pnpm vitest run tests/integration/

# E2E tests (Playwright — requires dev server running)
pnpm playwright test tests/e2e/preview-impact-flow.spec.ts
pnpm playwright test tests/e2e/concurrency-conflict-resolution.spec.ts
pnpm playwright test tests/e2e/edit-session-advisory-banner.spec.ts

# All tests (unit + contract + integration)
pnpm test

# All E2E
pnpm playwright test tests/e2e/
```

## Key Files to Implement

| Priority | File | Purpose |
|----------|------|---------|
| 1 | `database/migrations/031_create_stage_denominator_filter_rules_preview.sql` | Staging table for Option D |
| 1 | `database/migrations/032_create_config_versions.sql` | ConfigVersions table |
| 1 | `database/migrations/033_create_config_edit_sessions.sql` | Edit sessions table |
| 1 | `database/migrations/034_alter_usp_execute_pipeline_run_preview_session.sql` | Add @previewSessionId param |
| 1 | `database/migrations/035_alter_usp_build_filtered_denominator_preview.sql` | Add IF/ELSE branch for staged rules |
| 1 | `database/migrations/036_alter_usp_execute_pipeline_run_composite_dedup.sql` | Composite-key dedup |
| 1 | `database/migrations/037_alter_rule_change_audit_changetype.sql` | Audit extension |
| 2 | `src/frontend/core/application/dto/pipeline/PipelineTriggerDto.ts` | Add "Preview" + previewSessionId |
| 2 | `src/frontend/core/domain/repositories/IDenominatorPreviewRepository.ts` | Interface |
| 2 | `src/frontend/core/domain/repositories/IConfigVersionRepository.ts` | Interface |
| 2 | `src/frontend/core/domain/entities/ConfigVersion.ts` | Domain entity |
| 2 | `src/frontend/core/domain/entities/ConfigEditSession.ts` | Domain entity |
| 3 | `src/frontend/lib/sse/sseStreamHelper.ts` | ReadableStream + event encoder |
| 3 | `src/frontend/core/application/services/denominatorPreviewService.ts` | Stage rules, orchestrate SSE |
| 3 | `src/frontend/core/application/services/configVersionService.ts` | OCC logic |
| 3 | `src/frontend/core/application/services/pipelineOrchestrationService.ts` | MODIFY: previewSessionId passthrough |
| 3 | `src/frontend/infrastructure/persistence/database/DenominatorPreviewDbRepository.ts` | SQL adapter |
| 3 | `src/frontend/infrastructure/persistence/database/ConfigVersionDbRepository.ts` | SQL adapter |
| 3 | `src/frontend/infrastructure/persistence/database/ValidationPipelineDbRepository.ts` | MODIFY: @previewSessionId |
| 3 | `src/frontend/infrastructure/persistence/memory/DenominatorPreviewMemoryRepository.ts` | Test double |
| 3 | `src/frontend/infrastructure/persistence/memory/ConfigVersionMemoryRepository.ts` | Test double |
| 3 | `src/frontend/infrastructure/clients/ADFPipelineClient.ts` | MODIFY: previewSessionId in body |
| 4 | `src/frontend/app/api/filters/denominator/[appId]/preview/route.ts` | REWRITE: SSE streaming |
| 4 | `src/frontend/app/api/filters/denominator/[appId]/route.ts` | MODIFY: OCC on PUT |
| 4 | `src/frontend/app/api/filters/[scope]/[appId]/edit-session/route.ts` | NEW: Session lifecycle |
| 4 | `src/frontend/app/api/pipeline/run/route.ts` | MODIFY: Stale run recovery |
| 5 | `pipelines/metrics-processing/pipeline.json` | Add previewSessionId parameter |

## Implementation Order

1. **Database first**: Migrations 031–037 (staging table, config tables, SP ALTERs)
2. **Domain layer**: Entities + repository interfaces (`IDenominatorPreviewRepository`, `IConfigVersionRepository`)
3. **Infrastructure**: SQL adapters + in-memory test doubles + SSE helper utility
4. **Application services**: `DenominatorPreviewService` (stage → trigger → stream → cleanup), `ConfigVersionService` (OCC check)
5. **Modify existing**: `PipelineOrchestrationService` (previewSessionId passthrough), `ADFPipelineClient` (body extension), `ValidationPipelineDbRepository` (SP param)
6. **API routes**: Rewrite preview route (SSE), modify filter PUT routes (OCC), new edit-session route, modify pipeline/run (stale recovery)
7. **Tests**: Unit → Contract → Integration (written alongside each layer per TDD — Constitution Principle IV)
8. **ADF pipeline**: Add `previewSessionId` parameter to `PL_MetricsProcessing` pipeline JSON
9. **UI**: Preview component (SSE consumption) + conflict dialog (depends on API being complete)
