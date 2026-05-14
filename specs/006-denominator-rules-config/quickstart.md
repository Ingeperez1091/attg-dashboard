# Quickstart: EPIC-008 Denominator Rules Configuration

**Updated**: 2026-04-01

## Goal

Implement denominator rules configuration with preview-before-save, adoption settings, RBAC enforcement, and audit logging using existing clean architecture and repository/factory patterns.

## Prerequisites

1. Repository root dependencies installed (`npm ci`).
2. Existing application/user/role seed data available.
3. SQL migrations runnable via scripts in `scripts/database/`.
4. Test environment uses in-memory repositories for deterministic CI behavior.

## Implementation Steps

1. Add denominator route handlers under existing API pattern:
  1. `src/frontend/app/api/denomindator-model/route.ts` (`GET` shared model fields)
  2. `src/frontend/app/api/filters/denominator/[appId]/route.ts` (`GET`, `PUT` for `/api/filters/denominator/{appId}`)
  3. `src/frontend/app/api/filters/denominator/[appId]/preview/route.ts` (`POST` for `/api/filters/denominator/{appId}/preview`)
  4. `src/frontend/app/api/filters/denominator/[appId]/settings/route.ts` (`GET`, `PUT` for `/api/filters/denominator/{appId}/settings`) if settings are managed separately.
2. Add/extend domain contracts in `src/frontend/core/domain`:
   1. Denominator rule and adoption setting entities/value objects.
   2. Repository interfaces for denominator configuration operations.
3. Add application services in `src/frontend/core/application/services`:
   1. Read rules.
   2. Update rules transactionally.
   3. Preview impact.
   4. Read/update adoption settings.
4. Implement persistence adapters:
   1. SQL repository in `src/frontend/infrastructure/persistence/database`.
   2. In-memory repository in `src/frontend/infrastructure/persistence/memory`.
   3. Runtime selection wiring in `src/frontend/infrastructure/persistence/runtime` and relevant factory/repository bundle files.
5. Add request validation schemas and authorization checks reusing existing middleware/session patterns.
6. Add or update database migrations for denominator rule/adoption/audit storage if not already present.
7. Build UI updates under denominator filter configuration page using canonical operator labels and type-aware selector behavior.

## Test Plan

1. Contract tests: `tests/contract/filters/denominator-filter-config/`
   1. Get rules returns scoped rule set.
   2. Put rules validates payload/operator/value and persists atomically.
   3. Preview returns current/projected values without mutation.
   4. Unauthorized flows return 401/403.
2. Integration tests: `tests/integration/filters/denominator-filter-config/`
   1. End-to-end edit + preview + save + audit.
   2. Concurrency/replace semantics and previous rule preservation on failures.
   3. Adoption settings persistence and validation.

## Local Validation Commands

Run from repository root:

```powershell
npm run lint
npx tsc --noEmit
npm test -- --passWithNoTests
```

Optional targeted suites (after tests are added):

```powershell
npx vitest run tests/contract/filters/denominator-filter-config tests/integration/filters/denominator-filter-config
```

Execution note: Run the targeted denominator suites before the full workspace test run so failures are isolated to EPIC-008 changes.


## Test Application IDs

| Application | UUID |
|-------------|------|
| Maestro | `10000000-0000-0000-0000-000000000001` |
| EYST | `10000000-0000-0000-0000-000000000002` |
| Prodigy | `10000000-0000-0000-0000-000000000003` |
| Vector | `10000000-0000-0000-0000-000000000004` |
| Navigate | `10000000-0000-0000-0000-000000000005` |

## Example API Calls

### Get Denominator Model Fields
```bash
curl http://localhost:3000/api/denomindator-model \
  -H "x-user-id: 30000000-0000-0000-0000-000000000001" \
  -H "x-user-role: administrator"
```

### Get Rules for Maestro
```bash
curl http://localhost:3000/api/filters/denominator/{appId} \
  -H "x-user-id: 30000000-0000-0000-0000-000000000001" \
  -H "x-user-role: administrator"
```

### Put Rules for Maestro
```bash
curl -X PUT http://localhost:3000/api/filters/denominator/{appId} \
  -H "x-user-id: 30000000-0000-0000-0000-000000000001" \
  -H "x-user-role: administrator" \
  -H "Content-Type: application/json" \
  -d '{
    "rules": [
      {
        "denominatorModelId": "50000000-0000-0000-0007-000000000000",
        "operator": "EQUALS",
        "value": "11420"
      },
      {
        "denominatorModelId": "50000000-0000-0000-000B-000000000000",
        "operator": "GREATER_THAN",
        "value": "2025-01-01"
      }
    ]
  }'
```

### Preview Rules
```bash
curl -X POST http://localhost:3000/api/filters/denominator/{appId}/preview \
  -H "x-user-id: 30000000-0000-0000-0000-000000000001" \
  -H "x-user-role: administrator" \
  -H "Content-Type: application/json" \
  -d '{
    "rules": [
      {
        "denominatorModelId": "50000000-0000-0000-0007-000000000000",
        "operator": "EQUALS",
        "value": "11420"
      }
    ]
  }'
```

### Get Adoption Settings
```bash
curl http://localhost:3000/api/filters/denominator/{appId}/settings \
  -H "x-user-id: 30000000-0000-0000-0000-000000000001" \
  -H "x-user-role: administrator"
```

### Update Adoption Settings
```bash
curl -X PUT http://localhost:3000/api/filters/denominator/{appId}/settings \
  -H "x-user-id: 30000000-0000-0000-0000-000000000001" \
  -H "x-user-role: administrator" \
  -H "Content-Type: application/json" \
  -d '{
    "adoptionLevel": "Engagement",
    "revenueMetric": "ETD_ANSRAmt",
    "numeratorSource": "Manual"
  }'
```

> **Note**: `adoptionLevel` accepts `"Engagement"` or `"Client"` (PascalCase). `numeratorSource` accepts `"Manual"` or `"API"`.

### Audit Trail

Every successful `PUT` to rules or settings writes an audit entry to `app.RuleChangeAudit`:

- Rules update (`PUT /api/filters/denominator/{appId}`) → `ChangeScope = 'Denominator'`
- Settings update (`PUT /api/filters/denominator/{appId}/settings`) → `ChangeScope = 'Adoption'`

The audit captures before/after JSON snapshots, actor user ID, and timestamp. In tests, retrieve entries via:

```typescript
import { getDenominatorAuditEntriesForTests } from "@/infrastructure/persistence/memory/DenominatorFilterMemoryRepository";
import { getAdoptionAuditEntriesForTests } from "@/infrastructure/persistence/memory/AdoptionSettingsMemoryRepository";

const denomEntries = getDenominatorAuditEntriesForTests(appId);
const adoptionEntries = getAdoptionAuditEntriesForTests(appId);
```

## Architecture Notes

- **Shared model**: `DenominatorModels` has no `ApplicationId` — 17 rows shared by all apps.
- **Per-app rules**: `DenominatorFilterRules` has `ApplicationId` FK — rules are per-application.
- **Atomic replace**: PUT replaces all active rules (deactivate old, insert new, audit log).
- **Preview is read-only**: No data persisted during preview.
- **Audit scope**: `RuleChangeAudit.ChangeScope` distinguishes Numerator/Denominator/Adoption entries.

## Expected Outcomes

1. Authorized users can view/edit denominator configuration for allowed applications only.
2. Preview always returns impact without persisting proposed rules.
3. Successful saves produce durable rule changes and audit entries.
4. All checks pass in CI (lint, type-check, contract/integration tests).

