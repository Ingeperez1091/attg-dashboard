# API Contract: Denominator Rules Impact Preview (SSE Streaming)

**Endpoint**: `POST /api/filters/denominator/:appId/preview`  
**Status**: Rewrite — now returns Server-Sent Events stream (Option D async flow)  
**Updated**: 2026-06-14

## Overview

The preview endpoint stages proposed denominator rules in `stage.DenominatorFilterRulesPreview`, triggers the **full production pipeline** (`usp_ExecutePipelineRun` with `@previewSessionId`), and streams results back via **Server-Sent Events (SSE)**. This implements Option D — zero logic duplication, guaranteed parity with production metrics.

The connection is held open for the duration of pipeline execution (3–15s) and delivers progress events followed by a terminal `complete` or `error` event.

## Request

### Headers
| Header | Required | Value |
|--------|----------|-------|
| Content-Type | Yes | `application/json` |
| Authorization | Yes | `Bearer <token>` (Azure AD token stored in client sessionStorage) |

### Path Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| appId | UUID | Application ID (must exist in `app.Applications`) |

### Body Schema (Zod: `previewRequestSchema`)
```json
{
  "rules": [
    {
      "denominatorModelId": "uuid-string",
      "operator": "EQUALS | NOT_EQUALS | CONTAINS | NOT_CONTAINS | IN_LIST | NOT_IN_LIST | GREATER_THAN | GREATER_OR_EQUAL | LESS_THAN | LESS_OR_EQUAL",
      "value": "string"
    }
  ]
}
```

**Validation**:
- `rules` — non-empty array (at least 1 rule)
- `denominatorModelId` — must reference an active, filterable field in `app.DenominatorModels` (`IsFiltirable = 1`)
- `operator` — must be from allowed operator enum (CHECK constraint values)
- `value` — non-empty string, max 512 chars

## Response

### 200 OK — SSE Event Stream

**Content-Type**: `text/event-stream`  
**Headers**:
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

**Event Schema**:

#### `event: status` (0..N occurrences)
```
event: status
data: {"stage": "queued", "pctComplete": 0, "previewRunId": "uuid-string"}

event: status
data: {"stage": "processing", "pctComplete": 25}

event: status
data: {"stage": "filtering_denominator", "pctComplete": 50}

event: status
data: {"stage": "matching_numerator", "pctComplete": 75}

event: status
data: {"stage": "calculating_metrics", "pctComplete": 90}
```

| Field | Type | Description |
|-------|------|-------------|
| `stage` | string | Current execution stage |
| `pctComplete` | number (0-100) | Approximate progress percentage |
| `previewRunId` | UUID | Sent on first status event only |

#### `event: complete` (exactly 1, terminal)
```
event: complete
data: {"current": {...}, "projected": {...}, "delta": {...}, "warnings": [...], "previewRunId": "uuid-string", "calculatedAtUtc": "2026-06-14T14:30:00.000Z"}
```

**Full payload**:
```json
{
  "current": {
    "adoptionPct": 42.3,
    "revenueSharePct": 38.1,
    "matchedCount": 1247,
    "denominatorCount": 2948,
    "denominatorRevenue": 48200000.00
  },
  "projected": {
    "adoptionPct": 58.7,
    "revenueSharePct": 51.2,
    "matchedCount": 1247,
    "denominatorCount": 2124,
    "denominatorRevenue": 34700000.00
  },
  "delta": {
    "adoptionPct": 16.4,
    "revenueSharePct": 13.1,
    "matchedCount": 0,
    "denominatorCount": -824,
    "denominatorRevenue": -13500000.00
  },
  "warnings": [
    "Denominator reduced by 28% — adoption % increases due to smaller base"
  ],
  "previewRunId": "a1b2c3d4-...",
  "calculatedAtUtc": "2026-06-14T14:30:00.000Z"
}
```

#### `event: error` (exactly 1, terminal — only if pipeline fails)
```
event: error
data: {"message": "Preview calculation failed. Please try again.", "previewRunId": "uuid-string"}
```

**Stream closes after terminal event (`complete` or `error`).**

### 400 Bad Request — Validation Error (immediate, no SSE)
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid request body.",
  "details": { "code": "INVALID_REQUEST_BODY" }
}
```

### 403 Forbidden — Insufficient Permissions (immediate, no SSE)
```json
{
  "error": "Forbidden",
  "message": "User does not have write access to this application's filters."
}
```

### 404 Not Found — Application Not Found (immediate, no SSE)
```json
{
  "error": "NotFound",
  "message": "Application not found"
}
```

## Authorization
- Requires: `application_owner` (for assigned application) or `administrator`
- Denies: `viewer` role → 403
- Auth check happens **before** SSE stream opens — errors returned as standard JSON

## Performance & Scale
- Target: < 5 seconds end-to-end for MVP volumes (< 50K rows)
- Scale: < 15 seconds for 200+ apps (500K+ rows)
- SSE connection held open for full duration — no separate polling needed
- Each preview is session-isolated (unique `SessionId`) — no concurrency guard
- Staged rules cleaned up on stream close (success or failure)

## Execution Flow (Internal)
1. Validate request body (Zod) — 400 if invalid
2. Auth check (`requireFilterWriteScope`) — 403 if unauthorized
3. Generate `SessionId` (UUID) and `runId` (UUID)
4. INSERT proposed rules into `stage.DenominatorFilterRulesPreview` (session-scoped)
5. CREATE `PipelineRun` record with `TriggerSource = 'Preview'`
6. Return SSE stream response
7. **Inside stream**: Trigger pipeline execution (local await or ADF + server-side poll)
8. **Inside stream**: On completion, read `MetricSnapshots` for `runId`, compute delta vs latest non-preview metrics
9. **Inside stream**: Send `complete` event with full metrics payload
10. **Cleanup**: DELETE staged rules for `SessionId`
11. **Close stream**

## Client Usage (TypeScript)
```typescript
const response = await fetch(`/api/filters/denominator/${appId}/preview`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({ rules })
});

const reader = response.body!.getReader();
const decoder = new TextDecoder();
// Parse SSE events from chunks...
```
