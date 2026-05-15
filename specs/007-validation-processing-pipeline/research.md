# Research: Validation Processing Pipeline (EPIC-BQM-006)

## R1 — Local Denominator Snapshot Architecture

**Task**: Research whether the pipeline should query the external Mercury server directly or use a local cached snapshot, considering connectivity and architecture constraints.

**Decision**: The pipeline operates exclusively on `app.vw_DenominatorLocal` (a thin view over `stage.DenominatorSnapshot`). The snapshot is maintained by a separate weekly load process independent of the pipeline runtime. Pipeline run metadata includes the snapshot date for transparency about data freshness.

**Rationale**:
- External Mercury server is independently managed (A25) — no linked-server or cross-database queries available.
- Decoupling the pipeline from the external server ensures it never fails due to Mercury connectivity issues.
- Weekly refresh cadence aligns with Mercury report update frequency (A21).
- Including snapshot date in run metadata addresses the "stale snapshot" edge case.

**Alternatives Considered**:
- **Real-time query via linked server**: Rejected — A25 explicitly states linked-server access cannot be assumed.
- **Per-run copy from external server**: Rejected — too slow and would hammer the external server; weekly batch is sufficient.
- **Shared database / Synapse**: Rejected — A2 confirms single Azure SQL instance is sufficient for MVP.

---

## R2 — Denominator Filtering via Parameterized Dynamic SQL

**Task**: Research best practices for building dynamic SQL WHERE clauses from user-configurable filter rules stored in database tables, applied to `app.vw_DenominatorLocal`.

**Decision**: Use parameterized dynamic SQL inside T-SQL stored procedures (`usp_BuildFilteredDenominator`). Rules are read from `app.DenominatorFilterRules` joined with `app.DenominatorModels` to resolve column names. The procedure builds a WHERE clause string with `sp_executesql` and typed parameters — never concatenating user-provided values directly into SQL text. Column names are validated against `DenominatorModels.SourceColumn` (whitelist).

**Rationale**:
- `sp_executesql` with typed parameters prevents SQL injection while allowing dynamic column selection.
- `DenominatorModels.SourceColumn` maps logical field names to actual Mercury view column names (e.g., `[EngagementServiceCode]`).
- Operator dispatch uses a CASE expression to emit the correct T-SQL syntax for canonical operators (`EQUALS`, `NOT_EQUALS`, `CONTAINS`, `NOT_CONTAINS`, `IN_LIST`, `NOT_IN_LIST`, `GREATER_THAN`, `GREATER_OR_EQUAL`, `LESS_THAN`, `LESS_OR_EQUAL`). Unknown operators raise an explicit error.
- Rules are applied as AND-combined predicates (per assumptions A9, A13).
- Result is materialized into a temp table `#FilteredDenom` for downstream steps within the same connection.

**Alternatives Considered**:
- **ADF Mapping Data Flow with filter transforms**: Rejected — moves data outside SQL, slower for <100K rows per A18.
- **Inline SQL in the API layer**: Rejected — violates separation of concerns; pipeline logic should be database-side and independently testable.
- **Table-valued function instead of SP**: Rejected — TVFs cannot use temp tables or dynamic SQL easily; SPs are more flexible for multi-step processing.

---

## R3 — Numerator Field Extraction via JSON_VALUE

**Task**: Research approach for parsing JSON payloads from `stage.EngagementUsageRaw.PayloadJson` and extracting field values using model-driven configuration from `app.ApplicationModelFields`.

**Decision**: Use T-SQL `JSON_VALUE` with dynamic JSON paths generated from `app.ApplicationModelFields` rows. Each row defines a `SourcePath` (JSON path) and `FieldType` (determines SQL type for `TRY_CAST`). The orchestrator stored procedure (`usp_ExecutePipelineRun`) dynamically builds extraction logic per field; `TRY_CAST` provides NULL-on-failure semantics.

**Rationale**:
- `JSON_VALUE` is native to SQL Server 2016+ / Azure SQL — no external tooling needed.
- Model-driven approach: adding a new field to `ApplicationModelFields` requires no code changes; the SP dynamically constructs the extraction.
- `TRY_CAST` provides lenient type coercion (NULL on failure) per constitution Principle I.
- Performance is excellent for expected payload sizes (single JSON object per row, 5-7 fields).
- Keeps data server-side — no round-trip to Node.js process during ingestion.

**Alternatives Considered**:
- **OPENJSON with dynamic WITH clause**: Considered — more flexible for variable-field extraction but harder to build dynamically in T-SQL. `JSON_VALUE` per field is simpler for the expected 5-7 fields per app.
- **Client-side JSON parsing (TypeScript)**: Rejected — requires reading all staged rows into Node.js memory, parsing, then writing back. T-SQL approach avoids data movement.
- **Azure Functions for parsing**: Rejected — adds external compute dependency and network round-trip per record.

---

## R4 — Duplicate Detection Strategy

**Task**: Research approach for detecting and handling duplicate numerator records within the same ingestion batch based on match key.

**Decision**: Use `ROW_NUMBER() OVER (PARTITION BY matchKey ORDER BY StageId DESC)` to rank records by recency within each unique match key. Records with `rn > 1` are flagged as duplicates in `app.ValidationResults`. Only the latest record (rn = 1) proceeds to filtering and matching steps.

**Rationale**:
- Mirrors the pandas `drop_duplicates(keep='last')` behavior from the reference notebooks.
- `StageId` is an identity column — higher value = later ingestion = "latest".
- Deterministic and SQL-native — no application layer code needed.
- Spec requirement (US-1 scenario 4, FR-005): "keeping only the latest record per unique match key (by stage record ordering)".

**Alternatives Considered**:
- **Keep first instead of last**: Rejected — spec explicitly requires "latest by stage record ordering"; newer submissions override older ones.
- **Application-side dedup before staging**: Rejected — raw data must be preserved per constitution Principle I.
- **Hash-based fingerprinting**: Rejected — simpler ROW_NUMBER approach is sufficient for expected cardinalities.

---

## R5 — Filter Rule Snapshotting and Auditability

**Task**: Research how to capture the active filter rules at pipeline run start and maintain auditability when rules change between runs.

**Decision**: At the beginning of each pipeline run, the orchestrator stored procedure (`usp_ExecutePipelineRun`) reads all active numerator and denominator filter rules for the application from `app.NumeratorFilterRules` / `app.DenominatorFilterRules`, serializes them as JSON via `FOR JSON PATH`, and inserts into `app.FilterRuleSnapshots` linked to the `PipelineRunId`. The filtering sub-procedures (`usp_BuildFilteredDenominator`, `usp_ApplyNumeratorFilters`) read rules from the live source tables at runtime — the snapshot serves as an immutable audit record.

**Rationale**:
- Prevents mid-run rule changes from affecting ongoing pipeline execution (mitigates "Rule change mid-run" edge case).
- JSON serialization via `FOR JSON PATH` is compact and queryable via `OPENJSON` for replay/debugging.
- Auditability: any past pipeline run can be revalidated by comparing its snapshot against current rules.
- Implementation is simple: one INSERT per rule type per run, done synchronously inside the orchestrator SP.
- Reading from live tables at sub-SP runtime ensures consistency (snapshot is taken at start of same transaction).

**Alternatives Considered**:
- **Versioned rules table with effective dates**: Rejected — more complex; snapshot-per-run is simpler and meets all requirements.
- **Read rules at each sub-step**: Rejected — risks inconsistency if rules change between steps 2 and 4.
- **Table-copy approach (INSERT INTO snapshot FROM rules)**: Considered but JSON is more compact and easier to diff/audit across runs.

---

## R6 — Pipeline Execution via ADF Orchestration and Stored Procedures

**Task**: Research how to execute the pipeline processing without blocking the user session, supporting both production (Azure) and local development runtimes.

**Decision**: Encapsulate all pipeline logic in T-SQL stored procedures: `usp_ExecutePipelineRun` (orchestrator), `usp_BuildFilteredDenominator` (denominator filtering), and `usp_ApplyNumeratorFilters` (numerator filtering). Trigger execution via a dual-mode ADF client (`adfClient.ts`):

- **Production (ADF env vars set)**: Client acquires Azure AD token via service principal, triggers `PL_MetricsOrchestrator` ADF pipeline via Azure Management REST API. ADF calls `usp_ExecutePipelineRun` as a Stored Procedure Activity.
- **Local development (no ADF env vars)**: Client calls `usp_ExecutePipelineRun` directly via `mssql` connection pool (fire-and-forget).

API route (`POST /api/pipeline/run`) creates a `PipelineRuns` record (status `Queued`), calls `triggerPipelineExecution()` fire-and-forget, and responds with `RunId`. SP updates status `Queued` → `Processing` → `Completed`/`Failed`. Client polls via `GET /api/pipeline/[runId]` for status.

**Rationale**:
- All pipeline logic in T-SQL — no data round-trip between SQL Server and Node.js during processing.
- SPs are independently testable and deployable without application code changes.
- ADF provides production-grade orchestration, monitoring, retry, and alerting.
- Dual-mode client enables local development without ADF infrastructure.
- Fire-and-forget pattern satisfies FR-012 (no session blocking) and FR-013 (status polling).

**Alternatives Considered**:
- **In-process TypeScript fire-and-forget**: Initially implemented, then replaced — moves too much logic into application layer, lacks production orchestration, requires Node.js process to stay alive.
- **WebSockets / Server-Sent Events for real-time updates**: Rejected for MVP — adds infrastructure complexity. Polling on `/api/pipeline/[runId]` is sufficient for 5 applications.
- **Azure Service Bus queue**: Rejected — overkill for MVP. ADF provides sufficient orchestration.
- **ADF Data Flows**: Rejected — moves data outside SQL, slower for <100K rows per A18. Stored Procedure Activities keep processing server-side.

---

## R7 — One-Application-Per-Run Processing Model

**Task**: Research whether to process all applications in a single pipeline run or keep them separate for failure isolation and auditability.

**Decision**: Each pipeline run (`app.PipelineRuns`) is scoped to a single application identity. The orchestrator (ADF or application API) triggers fan-out across all active applications. The stored procedure `usp_ExecutePipelineRun` accepts `@ApplicationId` as a parameter.

**Rationale**:
- Simplifies failure isolation — one application's bad data doesn't block others.
- Improves rerun behavior — retry only the failed application, not all 5.
- Enhances traceability — `PipelineRunId` correlates to exactly one application.
- Enables RBAC-scoped visibility — a user sees runs only for applications they're assigned to.

**Alternatives Considered**:
- **Single run that processes all applications together**: Rejected — partial-failure handling and diagnostics become difficult. Reruns become expensive.

---

## R8 — Validation Result Persistence and Role-Scoped Querying

**Task**: Research how to persist per-record validation outcomes and expose summary results with role-based access control.

**Decision**: Each processed record produces one row in `app.ValidationResults` with columns: `RecordId`, `PipelineRunId`, `Status` (enum: `Valid`, `Invalid`, `Duplicate`, `FilteredOut`), `ErrorMessage` (human-readable reason), and timestamps. The API endpoints for validation visibility (`GET /api/pipeline/validation-results/[appId]` and `GET /api/pipeline/validation-results/[appId]/summary`) join `ValidationResults` with `app.UserApplications` to enforce role-scoped visibility. Aggregation (count by status, count by error type) is done in SQL via parameterized queries.

**Rationale**:
- Per-record granularity supports both summary views (SC-003: within 10 seconds) and drill-down to individual record errors.
- SQL-side aggregation avoids transferring thousands of rows to the API layer.
- Role-scoped queries leverage existing `UserApplications` table — no new authorization infrastructure.
- `PipelineRunId` FK enables querying results for a specific run.

**Alternatives Considered**:
- **JSON blob per run instead of per-record rows**: Rejected — cannot efficiently aggregate or filter individual records.
- **Client-side aggregation**: Rejected — transfers too much data; violates 10-second performance target.
- **Separate error log table**: Rejected — `ValidationResults` with status enum covers all cases in a single table.

---

## R9 — Clean Architecture Boundaries in Application Code

**Task**: Research code organization principles for the pipeline feature to align with the existing clean architecture and constitutional requirements.

**Decision**: API route handlers (`src/frontend/app`) remain thin transport adapters that call service classes. Orchestration logic lives in `core/application/services` (e.g., `PipelineOrchestrationService`). Persistence logic lives in `infrastructure/persistence` with repository interfaces in `core/domain/repositories`. Domain entities and contracts live in `core/domain/entities`.

**Rationale**:
- Required by constitution Principle VII — enforces testability and reduces coupling.
- Aligns with existing project structure conventions (seen in `DenominatorFilterService`, repositories, etc.).
- Enables independent testing: service layer tests use in-memory repositories; infrastructure tests verify SQL queries.

**Alternatives Considered**:
- **Put business logic directly in route handlers**: Rejected — violates constitution; hard to test.
- **Blend domain contracts into infrastructure adapters**: Rejected — creates coupling; harder to swap implementations.

---

## R10 — In-Memory Repository Testing for Pipeline Logic

**Task**: Research testing strategy for pipeline components that aligns with the existing Vitest/in-memory repository infrastructure.

**Decision**: Create in-memory repository implementations for `PipelineRuns`, `ValidationResults`, `MatchedRecords`, and `FilterRuleSnapshots` matching the pattern used by existing repositories (e.g., `DenominatorFilterMemoryRepository`). Pipeline service modules accept repository interfaces via dependency injection. Unit tests exercise the full pipeline service flow against in-memory repositories with deterministic fixture data.

**Rationale**:
- Follows constitution Principle IV — tests run against isolated in-memory stores in test mode.
- No external database required for CI — tests are fast and deterministic.
- Same fixture data produces same results every run — enables reliable test isolation.
- Existing codebase already uses this pattern; maintains consistency.

**Alternatives Considered**:
- **Test-database per run**: Rejected — violates constitution (no external databases in tests).
- **Mock individual SQL calls**: Rejected — too brittle; in-memory repositories test the actual logic flow.
- **Docker-based SQL Server for tests**: Rejected — adds CI infrastructure complexity; in-memory approach is proven.
