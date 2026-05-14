# Contract: Metrics Calculation and Snapshot Persistence (EPIC-BQM-007)

## Scope

Defines external and internal interface expectations for retrieving metric snapshots, reading KPI history, and accessing pipeline run status with metrics context. KPI calculation is performed server-side within the existing validation pipeline as a final SQL stored procedure step — no calculation API endpoints are exposed.

## API Contracts

### 1 Read Latest Metric Snapshot (Application-Scoped)

Get the most recent successfully calculated KPI snapshot for an application.

Interface:
- Command/API: `GET /api/metrics/{appId}`

**Query Parameters**:
- `runId` (optional): Specific run to retrieve snapshot for. If omitted, returns latest completed run's snapshot.
- `includeSynthetic` (optional, boolean, default `false`): In non-production only, includes non-authoritative synthetic investment context when available.

Responses:

**Response 200**:
```json
{
  "snapshotId": "uuid",
  "applicationId": "uuid",
  "applicationName": "Maestro",
  "runId": "uuid",
  "calculationDate": "2026-05-07T14:30:00.000Z",
  "denominatorCount": 1200,
  "numeratorCount": 875,
  "matchedCount": 875,
  "adoptionPct": 72.9167,
  "denominatorRevenue": 5432100.50,
  "numeratorRevenue": 3754850.30,
  "revenuePct": 68.4200,
  "onTarget": true,
  "avgEngagement": null,
  "metricDefinitionVersion": "EPIC-007-v1",
  "refreshTimestamp": "2026-05-07T14:30:05.000Z",
  "syntheticInvestment": null
}
```

**Response 200** (with synthetic context, non-production only):
```json
{
  "snapshotId": "uuid",
  "applicationId": "uuid",
  "applicationName": "Maestro",
  "runId": "uuid",
  "calculationDate": "2026-05-07T14:30:00.000Z",
  "denominatorCount": 1200,
  "numeratorCount": 875,
  "matchedCount": 875,
  "adoptionPct": 72.9167,
  "denominatorRevenue": 5432100.50,
  "numeratorRevenue": 3754850.30,
  "revenuePct": 68.4200,
  "onTarget": true,
  "avgEngagement": null,
  "metricDefinitionVersion": "EPIC-007-v1",
  "refreshTimestamp": "2026-05-07T14:30:05.000Z",
  "syntheticInvestment": {
    "investmentId": "uuid",
    "calculationDate": "2026-05-01T00:00:00.000Z",
    "investmentAmount": 75000,
    "isSynthetic": true,
    "nonAuthoritativeLabel": "NON_AUTHORITATIVE_SYNTHETIC",
    "sourceBatchId": "epic-007-seed-20260501"
  }
}
```

**Response 400** (Validation Error):
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid application ID."
}
```

**Response 401** (Unauthorized): No valid session.  
**Response 403** (Forbidden): Authenticated but not allowed for this application.  
**Response 403** (Forbidden): `includeSynthetic=true` requested in production context.  
**Response 404** (Not Found): Application not found or no completed snapshots exist.

**Authorization**: `administrator` or user with access to the application.

Behavioral contract:
- Returns the most recent immutable snapshot for the authorized application scope.
- Applies role and application visibility constraints before returning data.
- `administrator` may query any application; non-admin is restricted to assigned applications.
- Returns 404 when no completed snapshot exists for the application (not an error condition).
- All KPI values are returned as persisted; no re-calculation occurs at retrieval time.
- Synthetic context, when requested and allowed, is explicitly labeled `NON_AUTHORITATIVE_SYNTHETIC`.

---

### 2 Read Metric Snapshot History (Application-Scoped)

Get paginated historical KPI snapshots for trend analysis.

Interface:
- Command/API: `GET /api/metrics/history/{appId}`

**Query Parameters**:
- `from` (optional): Start date (ISO 8601). Defaults to 90 days ago.
- `to` (optional): End date (ISO 8601). Defaults to now.
- `page` (optional): Page number, default 1.
- `pageSize` (optional): Results per page, default 20, max 100.

Responses:

**Response 200**:
```json
{
  "applicationId": "uuid",
  "applicationName": "Maestro",
  "totalCount": 12,
  "page": 1,
  "pageSize": 20,
  "snapshots": [
    {
      "snapshotId": "uuid",
      "runId": "uuid",
      "calculationDate": "2026-05-07T14:30:00.000Z",
      "denominatorCount": 1200,
      "numeratorCount": 875,
      "matchedCount": 875,
      "adoptionPct": 72.9167,
      "denominatorRevenue": 5432100.50,
      "numeratorRevenue": 3754850.30,
      "revenuePct": 68.4200,
      "onTarget": true,
      "avgEngagement": null,
      "metricDefinitionVersion": "EPIC-007-v1",
      "refreshTimestamp": "2026-05-07T14:30:05.000Z"
    }
  ]
}
```

**Response 200** (no snapshots in range):
```json
{
  "applicationId": "uuid",
  "applicationName": "Maestro",
  "totalCount": 0,
  "page": 1,
  "pageSize": 20,
  "snapshots": []
}
```

**Response 401**: Unauthorized.  
**Response 403**: User does not have access to this application.  
**Response 404**: Application not found.

**Authorization**: `administrator` or user with access to the application.

Behavioral contract:
- Returns paginated snapshots ordered by `calculationDate DESC`.
- Restricts visibility by role and application assignment.
- Empty result set for a valid application is a 200 (not 404) when no snapshots exist in the date range.
- Each snapshot is immutable; values are never recalculated on retrieval.

---

### 3 Read Pipeline Run Metrics Summary

Get the metrics outcome attached to a specific pipeline run, including run lifecycle and KPI values.

Interface:
- Command/API: `GET /api/pipeline/{runId}/metrics`

Responses:

**Response 200**:
```json
{
  "runId": "uuid",
  "applicationId": "uuid",
  "status": "Completed",
  "startTime": "2026-05-07T14:30:01.000Z",
  "endTime": "2026-05-07T14:30:45.000Z",
  "matchedCount": 875,
  "snapshot": {
    "snapshotId": "uuid",
    "calculationDate": "2026-05-07T14:30:40.000Z",
    "adoptionPct": 72.9167,
    "denominatorRevenue": 5432100.50,
    "numeratorRevenue": 3754850.30,
    "revenuePct": 68.4200,
    "onTarget": true,
    "avgEngagement": null,
    "metricDefinitionVersion": "EPIC-007-v1"
  }
}
```

**Response 200** (run completed without snapshot — edge case, failed calculation):
```json
{
  "runId": "uuid",
  "applicationId": "uuid",
  "status": "Failed",
  "startTime": "2026-05-07T14:30:01.000Z",
  "endTime": "2026-05-07T14:30:45.000Z",
  "matchedCount": 875,
  "snapshot": null
}
```

**Response 401**: Unauthorized.  
**Response 403**: User does not have access to the application for this run.  
**Response 404**: Run ID not found.

**Authorization**: `administrator` or user with access to the run's application.

Behavioral contract:
- Returns combined run lifecycle and snapshot in a single response.
- `snapshot` is null when the run failed or metrics calculation was not reached.
- Applies role/application visibility; non-admin may not access runs from other applications.

---

## Processing Semantics Contract

Required semantics:
- KPI calculation is SQL-native (T-SQL stored procedure `usp_CalculateMetrics`), invoked as Step 7 within `usp_ExecutePipelineRun`.
- Calculation inputs: `app.MatchedRecords` (distinct numerator key counts and row-level numerator revenue), `app.AdoptionSettings` (adoption level and denominator revenue metric), `stage.DenominatorSnapshot` / `app.vw_DenominatorLocal` (filtered denominator aggregates).
- Calculation outputs: one row in `app.MetricSnapshots` per successful run + application scope.
- A pipeline run can persist at most one metric snapshot; additional inserts for the same `RunId` must fail.
- `PipelineRuns.Status = Completed` is set only after `MetricSnapshots` insert succeeds.
- Calculation failure rolls back snapshot insert; no partial state is committed.
- All KPI values are divide-by-zero safe via `NULLIF` — no runtime exceptions for zero denominators.
- Recalculation for the same application scope must execute as a new pipeline run (`RunId`), producing a new distinct snapshot; prior snapshots are never replaced.
- Synthetic investment values (`IsSynthetic = 1`) are non-authoritative and not exposed in production retrieval contexts.

---

## API Usage Examples

1. Read latest snapshot:

```http
GET /api/metrics/{appId}
```

2. Read latest snapshot for a specific run:

```http
GET /api/metrics/{appId}?runId={runId}
```

3. Read latest snapshot with synthetic context (non-production only):

```http
GET /api/metrics/{appId}?includeSynthetic=true
```

4. Read history with pagination:

```http
GET /api/metrics/history/{appId}?from=2026-05-01T00:00:00.000Z&to=2026-05-31T23:59:59.999Z&page=1&pageSize=20
```

5. Read run metrics summary:

```http
GET /api/pipeline/{runId}/metrics
```

---

## Error Matrix

| Endpoint | Condition | Status | Error Code |
|----------|-----------|--------|------------|
| `GET /api/metrics/{appId}` | Invalid `appId` format | 400 | `VALIDATION_ERROR` |
| `GET /api/metrics/{appId}` | Invalid query params | 400 | `VALIDATION_ERROR` |
| `GET /api/metrics/{appId}` | Missing or invalid session | 401 | `UNAUTHORIZED` |
| `GET /api/metrics/{appId}` | App scope forbidden | 403 | `FORBIDDEN` |
| `GET /api/metrics/{appId}` | `includeSynthetic=true` in production | 403 | `FORBIDDEN` |
| `GET /api/metrics/{appId}` | No snapshot for scope | 404 | `NOT_FOUND` |
| `GET /api/metrics/history/{appId}` | Invalid path/query | 400 | `VALIDATION_ERROR` |
| `GET /api/metrics/history/{appId}` | Missing or invalid session | 401 | `UNAUTHORIZED` |
| `GET /api/metrics/history/{appId}` | App scope forbidden | 403 | `FORBIDDEN` |
| `GET /api/metrics/history/{appId}` | App not found/inactive | 404 | `NOT_FOUND` |
| `GET /api/pipeline/{runId}/metrics` | Invalid `runId` format | 400 | `VALIDATION_ERROR` |
| `GET /api/pipeline/{runId}/metrics` | Missing or invalid session | 401 | `UNAUTHORIZED` |
| `GET /api/pipeline/{runId}/metrics` | Run scope forbidden | 403 | `FORBIDDEN` |
| `GET /api/pipeline/{runId}/metrics` | Run not found | 404 | `NOT_FOUND` |

**Pipeline trigger boundary**:
- The pipeline is triggered by numerator ingestion (`triggerSource = "API"`) or ADF schedule (`triggerSource = "ADF"`) only.
- Filter rule changes (numerator or denominator) do NOT trigger a pipeline run. Rule updates affect classification logic, not the staged dataset; persisted metric history must not be modified by a configuration-only change.
- A future "rule impact preview" feature will allow transient KPI previews from proposed rule changes without creating a run or writing to `app.MetricSnapshots`. That feature is **out of scope for EPIC-BQM-007**.

## Data Persistence Contract

Required writes per successful run:
- `app.PipelineRuns`: lifecycle, summary counts, and final `Completed` status.
- `app.MetricSnapshots`: one immutable KPI snapshot with full governance metadata.
- `app.FilterRuleSnapshots`: (from EPIC-BQM-006) numerator and denominator rules used at run time.

## Stored Procedure Contract

### app.usp_CalculateMetrics

Calculates and persists KPI metrics as the final step of pipeline execution.

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `@RunId` | UNIQUEIDENTIFIER | The pipeline run to calculate metrics for |
| `@ApplicationId` | UNIQUEIDENTIFIER | Application scope for calculation |

**Behavior**: Reads `app.AdoptionSettings` for the application to determine `AdoptionLevel` and `RevenueMetric`. Aggregates matched count and revenue from `app.MatchedRecords` for the given run. Aggregates denominator count and revenue via parameterized dynamic SQL against `app.vw_DenominatorLocal` using the rules in `app.FilterRuleSnapshots`. 

Calculates KPI metrics using the following canonical formulas:
- **AdoptionPct** (engagement metric): Clipped to [0, 100] range. Formula: `adoption = Math.max(0, Math.min(100, (NumeratorCount / DenominatorCount) * 100))`, where counts are DISTINCT keys (ClientID or EngagementID based on `AdoptionLevel`).
- **DenominatorRevenue** and **NumeratorRevenue**: Persisted for audit and traceability. `NumeratorRevenue` is summed from ALL matched records (including duplicates) from the model metric field (`IsMetricDimension` source path). `DenominatorRevenue` is summed from filtered denominator rows using `AdoptionSettings.RevenueMetric`.
- **RevenuePct** (revenue share): Clipped to [0, 100] range. Formula: `revenueShare = Math.max(0, Math.min(100, (NumeratorRevenue / DenominatorRevenue) * 100))`
- **OnTarget** (high adoption indicator - NOT persisted): Calculated on-the-fly in UI layer. Formula: `onTarget = adoptionPct > 70%`
- **AvgEngagement**: Currently NULL. Will be calculated when per-matched-record engagement scores are available.

Validation contract:
- Validation must detect DISTINCT numerator keys (ClientID or EngagementID per `AdoptionLevel`) that are present in numerator input but missing from filtered denominator scope.
- Keys missing from denominator are persisted as invalid validation outcomes and excluded from `NumeratorCount`/`NumeratorRevenue`.

Inserts one row into `app.MetricSnapshots` with full governance metadata. All calculation and insert logic executes within the transaction context provided by the caller (`usp_ExecutePipelineRun`).

**Error Handling**: Raises an exception if `app.AdoptionSettings` has no active row for the application. Raises an exception if the `MetricSnapshots` insert fails. Exceptions propagate to caller to trigger transaction rollback and run status update to `Failed`.
