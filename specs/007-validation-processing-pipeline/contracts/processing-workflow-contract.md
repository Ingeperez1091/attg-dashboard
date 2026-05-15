# Contract: Validation Processing Workflow (EPIC-BQM-006)

## Scope

Defines external and internal interface expectations for triggering processing runs, retrieving run status, and reading validation outcomes.

## API Contracts

### 1 Trigger Processing Run

Trigger a new pipeline run for a specific application.

Interface:
- Command/API: `POST /api/pipeline/run`

**Request**:
```json
{
  "applicationId": "uuid",
  "triggerSource": "API"
}
```

**Request Validation** (Zod):
- `applicationId`: required, valid UUID, must exist in `app.Applications`
- `triggerSource`: required, one of `["API", "ADF", "Manual"]`

Responses:

**Response 201** (Created):
```json
{
  "runId": "uuid",
  "applicationId": "uuid",
  "status": "Queued",
  "triggerSource": "API",
  "createDate": "2026-04-16T14:30:00.000Z",
  "executionMode": "local"
}
```

**Response 400** (Validation Error):
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid request body."
}
```

**Response 401** (Unauthorized): No valid session.  
**Response 403** (Forbidden): authenticated but not allowed for target application. 
**Response 404** (Not Found): The specified application was not found or is inactive.  
**Response 409** (Conflict): A pipeline run is already in progress for this application.

**Authorization**: `administrator` or `application_owner` with access to the application.


Behavioral contract:
- Validates caller authorization before run creation.
- Creates a `PipelineRun` in `Queued` status.
- In production, dispatches asynchronous processing by triggering ADF (`PL_MetricsOrchestrator`) and does not execute the processing stored procedure directly from the API runtime.
- In local development only (when ADF configuration is intentionally absent), direct invocation of `app.usp_ExecutePipelineRun` is allowed as a fallback.
- Returns run identifier, initial status, and dispatch mode (`executionMode`: `adf` or `local`).

---

### 2 Read Processing Run Status

Get the status and metadata for a specific pipeline run.

Interface:
- Command/API: `GET /api/pipeline/{runId}`

Responses:

**Response 200**:
```json
{
  "runId": "uuid",
  "applicationId": "uuid",
  "status": "Completed",
  "startTime": "2026-04-16T14:30:01.000Z",
  "endTime": "2026-04-16T14:30:15.000Z",
  "triggerSource": "API",
  "snapshotDate": "2026-04-14T00:00:00.000Z",
  "totalRecordsIn": 500,
  "validCount": 480,
  "invalidCount": 12,
  "duplicateCount": 3,
  "filteredOutCount": 5,
  "matchedCount": 475,
  "errorMessage": null,
  "createDate": "2026-04-16T14:30:00.000Z"
}
```

**Note**: `duplicateCount` reflects the number of repeated incoming numerator keys (occurrences beyond the first). Duplicate keys are accepted and preserved as row-level records for matching and revenue aggregation.

**Response 401**: Unauthorized.  
**Response 403**: (Forbidden) User does not have access to the application for this run.  
**Response 404**: (Not Found) Run ID not found.

**Authorization**: `administrator` or user with access to the run's application.


Behavioral contract:
- Returns run lifecycle, summary counts, and timestamps.
- Applies role/application visibility constraints.

---

### 3 Read Validation Outcomes (Application-Scoped, Optional Run Filter)

Get paginated validation results for a pipeline run.

Interface:
- Command/API: `GET /api/pipeline/validation-results/{appId}`

**Query Parameters**:
- `runId` (optional): Specific run to query. If omitted, uses latest completed run.
- `status` (optional): Filter by status (`Valid`, `Invalid`, `Duplicate`, `FilteredOut`)
- `page` (optional): Page number, default 1
- `pageSize` (optional): Results per page, default 50, max 200

Responses:

**Response 200**:
```json
{
  "applicationId": "uuid",
  "runId": "uuid",
  "totalCount": 500,
  "page": 1,
  "pageSize": 50,
  "results": [
    {
      "resultId": "uuid",
      "stageId": "00000000-0000-0000-0000-000000000000",
      "recordKey": "ENG-12345",
      "status": "Invalid",
      "errorMessage": "Engagement ID ENG-12345 not found in denominator",
      "createDate": "2026-04-16T14:30:05.000Z"
    }
  ]
}
```

**Response 401/403/404**: Same as above.

**Authorization**: `administrator` or user with access to the run's application.


Behavioral contract:
- Returns summary and detailed outcomes for valid/invalid/duplicate/filtered-out/unmatched records.
- Restricts visibility by role and application assignment.

---

### 4 Read Validation Error Summaries

Get validation error summary for an application's most recent pipeline run.

Interface:
- Command/API: `GET /api/pipeline/validation-results/{appId}/summary`

**Query Parameters**:
- `runId` (optional): Specific run to query. If omitted, uses latest completed run.

Responses:

**Response 200**:
```json
{
  "applicationId": "uuid",
  "applicationName": "Maestro",
  "runId": "uuid",
  "runDate": "2026-04-16T14:30:15.000Z",
  "summary": {
    "totalRecords": 500,
    "validCount": 480,
    "invalidCount": 12,
    "duplicateCount": 3,
    "filteredOutCount": 5,
    "matchedCount": 475
  },
  "errorBreakdown": [
    {
      "errorType": "ID not found in denominator",
      "count": 10
    },
    {
      "errorType": "Missing Engagement/Client ID",
      "count": 2
    },
    {
      "errorType": "Failed filter rule: Budget >= 20000",
      "count": 5
    }
  ]
}
```

**Response 200** (no runs exist):
```json
{
  "applicationId": "uuid",
  "applicationName": "Maestro",
  "runId": null,
  "runDate": null,
  "summary": null,
  "errorBreakdown": []
}
```

**Response 401**: Unauthorized.  
**Response 403**: User does not have access to this application.  
**Response 404**: Application not found.

**Authorization**: Any role with access to the application. `administrator` can query any application.

---

## Processing Semantics Contract

Required semantics:
- One application per run.
- Local denominator source only (`stage.DenominatorSnapshot` / `app.vw_DenominatorLocal`).
- AND-combined denominator and numerator rule evaluation.
- Duplicate detection before matched outcome persistence.
- Explicit reason context for all non-valid outcomes.
- Rule snapshot persisted at run start and used consistently for full run.
- Production orchestration is ADF-driven; API acts as trigger surface and status reader.
- Direct SP execution is development-only fallback and not a production execution mode.

## Data Persistence Contract

Required writes per run:
- `app.PipelineRuns`: lifecycle and summary counts.
- `app.ValidationResults`: per-record outcome + reason context.
- `app.MatchedRecords`: matched outcomes for downstream metrics.
- `app.FilterRuleSnapshots`: numerator and denominator rules used by run.



### 1. Stored Procedure Contracts

#### app.usp_BuildFilteredDenominator

Builds the filtered denominator (addressable population) for one application.

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `@ApplicationId` | UNIQUEIDENTIFIER | Application to filter for |
| `@PipelineRunId` | UNIQUEIDENTIFIER | For logging/metadata |
| `@FilteredCount` | INT OUTPUT | Returns the addressable population count |

**Behavior**: Reads active rules from `app.DenominatorFilterRules` joined with `app.DenominatorModels` for the given application. Builds a dynamic SQL WHERE clause using `sp_executesql` with typed parameters. Column names are validated against a whitelist derived from `DenominatorModels.SourceColumn`. Supports all 10 canonical operators: `EQUALS`, `NOT_EQUALS`, `GREATER_THAN`, `GREATER_OR_EQUAL`, `LESS_THAN`, `LESS_OR_EQUAL`, `IN_LIST`, `NOT_IN_LIST`, `CONTAINS`, `NOT_CONTAINS`. Populates temp table `#FilteredDenom` with columns matching `app.vw_DenominatorLocal`.

**Error Handling**: Raises error if `app.vw_DenominatorLocal` is empty. Returns 0 count if no rules match.

---

#### app.usp_ApplyNumeratorFilters

Applies numerator filter rules to validated records.

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `@ApplicationId` | UNIQUEIDENTIFIER | Application to filter for |
| `@PipelineRunId` | UNIQUEIDENTIFIER | For result tracking |
| `@FilteredOutCount` | INT OUTPUT | Returns the number of records filtered out |

**Behavior**: Reads active rules from `app.NumeratorFilterRules` joined with `app.ApplicationModelFields` for the given application. For each validated record (status = `Valid` in `ValidationResults` for the given run), evaluates field-operator-value rules (AND-combined) using a cursor. Records failing any rule are updated to `FilteredOut` status with the specific rule name in `ErrorMessage`. Joins `ValidationResults` → `EngagementUsageRaw` via `CAST(eur.StageId AS NVARCHAR(36)) = vr.StageId` to access payload fields.

---

#### app.usp_ExecutePipelineRun

Main orchestrator stored procedure for a single pipeline run.

Invocation contract:
- Production: invoked by ADF Stored Procedure Activity.
- Local development fallback: may be invoked directly by application infrastructure when ADF is not configured.

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `@PipelineRunId` | UNIQUEIDENTIFIER | Pre-created run ID (status = Queued) |
| `@ApplicationId` | UNIQUEIDENTIFIER | Application to process |

**Steps**:
1. Update status → `Processing`, set `StartTime`
2. Snapshot active filter rules (numerator + denominator) via `FOR JSON PATH` → `FilterRuleSnapshots`
3. Call `usp_BuildFilteredDenominator(@ApplicationId, @PipelineRunId, @FilteredCount OUTPUT)` → builds `#FilteredDenom`
4. Parse numerator records from `stage.EngagementUsageRaw` using `JSON_VALUE` with `SourcePath` from `app.ApplicationModelFields`; match-key selection (`EngagementID` vs `ClientID`) comes from `app.AdoptionSettings.AdoptionLevel`
5. Parse row-level records and compute `DuplicateRank` for diagnostics/counting
6. Validate IDs against `#FilteredDenom` → bulk INSERT into `ValidationResults` (Valid/Invalid statuses)
7. Call `usp_ApplyNumeratorFilters(@ApplicationId, @PipelineRunId, @FilteredOutCount OUTPUT)`
8. Match row-level valid numerator records to `SELECT DISTINCT` denominator keys from `#FilteredDenom` using dynamic SQL (revenue metric from `AdoptionSettings.RevenueMetric` via QUOTENAME) → `MatchedRecords`
9. Update `PipelineRuns` with all counts and status → `Completed`

Note: Metric publication/persistence is handled by EPIC-BQM-007 and is out of scope for this workflow contract.

**Error Handling**: On error, update status → `Failed` with error message via TRY/CATCH. All intermediate results are preserved for debugging.

---

## 4. TypeScript Interface Contracts

### Pipeline Types

```typescript
type PipelineStatus = 'Queued' | 'Processing' | 'Completed' | 'Failed';
type ValidationStatus = 'Valid' | 'Invalid' | 'Duplicate' | 'FilteredOut';
type TriggerSource = 'API' | 'ADF' | 'Manual';

interface PipelineRun {
  runId: string;
  applicationId: string;
  status: PipelineStatus;
  startTime: string | null;
  endTime: string | null;
  triggerSource: TriggerSource;
  snapshotDate: string | null;
  totalRecordsIn: number | null;
  validCount: number | null;
  invalidCount: number | null;
  duplicateCount: number | null; // Repeated incoming numerator keys (occurrences beyond first)
  filteredOutCount: number | null;
  matchedCount: number | null;
  errorMessage: string | null;
  createDate: string;
}

interface ValidationResult {
  resultId: string;
  pipelineRunId: string;
  stageId: string;
  applicationId: string;
  recordKey: string | null;
  status: ValidationStatus;
  errorMessage: string | null;
  createDate: string;
}

interface MatchedRecord {
  matchedId: string;
  pipelineRunId: string;
  applicationId: string;
  numeratorKey: string;
  denominatorKey: string;
  revenueAmount: number | null;
  stageId: string | null;
  createDate: string;
}

interface ValidationErrorSummary {
  applicationId: string;
  applicationName: string;
  runId: string | null;
  runDate: string | null;
  summary: {
    totalRecords: number;
    validCount: number;
    invalidCount: number;
    duplicateCount: number; // Repeated incoming numerator keys (occurrences beyond first)
    filteredOutCount: number;
    matchedCount: number;
  } | null;
  errorBreakdown: Array<{
    errorType: string;
    count: number;
  }>;
}
```

---

Constraints:
- Staged source records remain immutable.
- All write operations use parameterized SQL.
- All tables include required audit columns.

