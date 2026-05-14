# Contract: Dashboard UI Grouping and Scoped Metrics Presentation (EPIC-BQM-014)

## Scope

Defines API and presentation contracts for dashboard grouping behavior, role-scoped visibility, and baseline UI state handling. Metric calculation and snapshot persistence remain owned by EPIC-BQM-007.

## API Contracts

## Canonical Response Schema (Task-Ready)

This section is normative for implementation and test contracts.

### Dashboard Usage Envelope

```json
{
  "scope": {
    "role": "administrator | application_owner | viewer",
    "applicationIds": ["uuid"],
    "selectedSubServiceLine": "string | null"
  },
  "hero": {
    "title": "string",
    "latestRunId": "uuid | null",
    "refreshTimestamp": "ISO-8601 datetime | null"
  },
  "kpis": {
    "investment": {
      "value": "number | null",
      "label": "string",
      "basis": "string | null",
      "isNonAuthoritative": "boolean"
    },
    "revenue": {
      "value": "number | null",
      "label": "string",
      "basis": "string | null",
      "isNonAuthoritative": "boolean"
    },
    "averageEngagement": {
      "value": "number | null",
      "label": "string",
      "basis": "string | null",
      "isNonAuthoritative": "boolean"
    },
    "onTargetRate": {
      "value": "number | null",
      "label": "string",
      "basis": "string | null",
      "isNonAuthoritative": "boolean"
    },
    "refreshTimestamp": "ISO-8601 datetime"
  },
  "groups": [
    {
      "groupType": "portfolio | subServiceLine | application",
      "groupKey": "string",
      "displayName": "string",
      "subServiceLine": "string | null",
      "metrics": {
        "denominatorCount": "number",
        "numeratorCount": "number",
        "matchedCount": "number",
        "adoptionPct": "number",
        "revenuePct": "number",
        "denominatorRevenue": "number | null",
        "numeratorRevenue": "number | null",
        "status": "On Target | Below Target | Unknown"
      },
      "children": []
    }
  ],
  "state": {
    "state": "ready | empty | inProgress | error",
    "message": "string",
    "lastSuccessfulRunId": "uuid | null",
    "isRecalculating": "boolean"
  },
  "legend": {
    "metricDefinitionVersion": "string | null"
  }
}
```

Validation constraints:
- `scope.role` must be one of: `administrator`, `application_owner`, `viewer`.
- `groups[].groupType` must be one of: `portfolio`, `subServiceLine`, `application`.
- `state.state` must be one of: `ready`, `empty`, `inProgress`, `error`.
- `adoptionPct` and `revenuePct` must be within [0, 100].
- `applicationIds` must already be authorization-scoped server-side.

### 1 Read Grouped Dashboard View (Application Usage)

Retrieve dashboard payload composed for portfolio, Sub Service Line, and application levels.

Interface:
- Command/API: `GET /api/dashboard/usage`

**Query Parameters**:
- `subServiceLine` (optional): Limit results to a single Sub Service Line.
- `runId` (optional): Retrieve snapshot payload for a specific completed run within authorized scope.

**Response 200**:
```json
{
  "scope": {
    "role": "viewer",
    "applicationIds": ["uuid"]
  },
  "hero": {
    "title": "Application Usage Dashboard",
    "latestRunId": "uuid",
    "refreshTimestamp": "2026-05-07T14:30:05.000Z"
  },
  "kpis": {
    "investment": { "value": 75000, "basis": null, "isNonAuthoritative": true },
    "revenue": { "value": 3754850.30, "basis": "FYTD", "isNonAuthoritative": false },
    "averageEngagement": { "value": null, "basis": null, "isNonAuthoritative": false },
    "onTargetRate": { "value": 72.9167, "basis": "adoption-threshold", "isNonAuthoritative": false }
  },
  "groups": [
    {
      "groupType": "subServiceLine",
      "groupKey": "Tax Technology",
      "displayName": "Tax Technology",
      "metrics": {
        "denominatorCount": 1200,
        "numeratorCount": 875,
        "matchedCount": 875,
        "adoptionPct": 72.9167,
        "revenuePct": 68.4200,
        "status": "On Target"
      },
      "children": [
        {
          "groupType": "application",
          "groupKey": "app-maestro",
          "displayName": "Maestro",
          "metrics": {
            "denominatorCount": 600,
            "numeratorCount": 460,
            "matchedCount": 460,
            "adoptionPct": 76.6667,
            "revenuePct": 71.1000,
            "status": "On Target"
          },
          "children": []
        }
      ]
    }
  ],
  "state": {
    "state": "ready",
    "message": "Metrics loaded successfully.",
    "isRecalculating": false
  },
  "legend": {
    "metricDefinitionVersion": "EPIC-007-v1"
  }
}
```

**Response 200 (empty)**:
```json
{
  "scope": {
    "role": "application_owner",
    "applicationIds": ["uuid"]
  },
  "hero": {
    "title": "Application Usage Dashboard",
    "latestRunId": null,
    "refreshTimestamp": null
  },
  "kpis": null,
  "groups": [],
  "state": {
    "state": "empty",
    "message": "No completed metrics are available for the selected scope.",
    "isRecalculating": false
  },
  "legend": {
    "metricDefinitionVersion": null
  }
}
```

**Response 401**: Unauthorized (no active session).  
**Response 403**: Forbidden (user lacks scope for requested app/run).  
**Response 500**: Retrieval error (non-technical message returned in state object).

Behavioral contract:
- Returns only authorized application data by role/application assignments.
- Does not recalculate KPI values; returns persisted snapshot values.
- Preserves payload shape across `ready`, `empty`, `inProgress`, and `error` states.
- Uses the explicit fallback label `Unassigned` when a scoped row has a null or blank Sub Service Line.
- When an unexpected retrieval failure occurs after session/query validation, returns a canonical dashboard envelope with `state.state = error` and a non-technical `DASHBOARD_DATA_UNAVAILABLE` contract code.

---

### 2 Read Dashboard Run-State Context

Retrieve run lifecycle context to drive in-progress indicator behavior.

Interface:
- Command/API: `GET /api/dashboard/usage/state`

**Response 200**:
```json
{
  "latestCompletedRunId": "uuid",
  "activeRun": {
    "runId": "uuid",
    "status": "Processing",
    "startTime": "2026-05-07T14:35:00.000Z"
  },
  "isRecalculating": true
}
```

Behavioral contract:
- If an active run exists and prior completed snapshot exists, dashboard state is `inProgress` while continuing to render latest completed data.
- If no active run exists, `isRecalculating` is false.

### Example Requests

```http
GET /api/dashboard/usage HTTP/1.1
Authorization: Bearer <session-token>
```

```http
GET /api/dashboard/usage?subServiceLine=Unassigned HTTP/1.1
Authorization: Bearer <session-token>
```

```http
GET /api/dashboard/usage/state HTTP/1.1
Authorization: Bearer <session-token>
```

## Security Notes

- Authorization scope is resolved before any snapshot or run-context query is executed.
- `subServiceLine` filtering is presentation-constrained and cannot widen `scope.applicationIds`.
- `runId` lookup must remain authorization-scoped through the validation pipeline service before usage payload retrieval.
- Error envelopes must not expose internal exception details; user-facing messages remain non-technical.
- Client keyboard filtering and status discovery are usability enhancements only; they do not alter server-side RBAC scope.

---

## Service Flow Pseudocode (Task-Ready)

The following pseudocode is normative for application-service and route-layer task decomposition.

```text
FUNCTION getDashboardUsage(query, session):
  REQUIRE authenticated session

  principal = resolvePrincipal(session)
  scope = resolveAuthorizedScope(principal)  // role + assigned applicationIds

  validatedQuery = validateQuery(query)
  IF validatedQuery.invalid:
    RETURN 400 VALIDATION_ERROR

  filteredScope = applyOptionalSubServiceLine(scope, validatedQuery.subServiceLine)

  // Security-first retrieval: never load unauthorized applications
  snapshots = fetchSnapshotsForScope(
    applicationIds = filteredScope.applicationIds,
    runId = validatedQuery.runId,
    latestOnly = (validatedQuery.runId is null)
  )

  runContext = fetchRunStateForScope(filteredScope.applicationIds)

  IF snapshots.empty AND runContext.hasNoCompletedRun:
    RETURN buildEmptyEnvelope(scope=filteredScope, runContext)

  grouped = aggregateHierarchy(
    snapshots,
    levels = [portfolio, subServiceLine, application]
  )

  kpis = buildKpiCardsFromPersistedValues(grouped.portfolioMetrics)
  state = deriveDashboardState(snapshots, runContext)
  legend = deriveLegend(snapshots)
  hero = deriveHero(runContext, snapshots)

  RETURN 200 {
    scope: filteredScope,
    hero,
    kpis,
    groups: grouped.subServiceLineGroups,
    state,
    legend
  }

CATCH authorization error:
  RETURN 403 FORBIDDEN

CATCH unexpected error:
  LOG structured telemetry (principal, scope size, runId, correlationId)
  RETURN 500 DASHBOARD_DATA_UNAVAILABLE with non-technical state.message
```

Security requirements in flow:
- Authorization scope resolution must occur before any snapshot query execution.
- API must never return data rows outside `scope.applicationIds`.
- Client-side filtering is presentation-only and cannot widen scope.

---

## Presentation Contract

Required dashboard sections:
1. Hero area
2. KPI row
3. Filter bar
4. Grouped detail panel
5. Footer legend

Grouping rules:
- Hierarchy order: portfolio -> Sub Service Line -> application.
- Sub Service Line filter applies before group rendering.
- Missing Sub Service Line values are placed in explicit fallback group label.

Status rules:
- `On Target` when adoption threshold policy is met.
- `Below Target` when threshold is not met.
- `Unknown` when required values are null/unavailable.

Accessibility/responsive baseline:
- Filter/group controls are keyboard navigable.
- Reduced-motion preference suppresses non-essential animation.
- KPI/grouped detail remain readable on mobile and desktop.

## Error Matrix

| Endpoint | Condition | Status | Error Code |
|----------|-----------|--------|------------|
| `GET /api/dashboard/usage` | Missing or invalid session | 401 | `UNAUTHORIZED` |
| `GET /api/dashboard/usage` | Scope forbidden | 403 | `FORBIDDEN` |
| `GET /api/dashboard/usage` | Invalid query parameter | 400 | `VALIDATION_ERROR` |
| `GET /api/dashboard/usage` | Internal retrieval failure | 500 | `DASHBOARD_DATA_UNAVAILABLE` |
| `GET /api/dashboard/usage/state` | Missing or invalid session | 401 | `UNAUTHORIZED` |
| `GET /api/dashboard/usage/state` | Scope forbidden | 403 | `FORBIDDEN` |

## Ownership Boundary

- In scope (EPIC-BQM-014): UI grouping composition, state rendering behavior, role-scoped retrieval/presentation contract.
- Out of scope (EPIC-BQM-014): KPI formula calculation, metric snapshot persistence, and pipeline computation logic.
- Deferred to EPIC-BQM-015: advanced trend controls, benchmark alerts, and expanded historical analytics interactions.
