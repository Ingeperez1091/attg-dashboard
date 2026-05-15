# Research: Metrics Calculation Dashboard (EPIC-BQM-007)

## R1 — KPI Calculation Source of Truth

**Task**: Research whether KPI calculations should be deterministic server-side operations using validated matched data or derived dynamically from UI/request parameters.

**Decision**: Calculate Adoption Percentage, Revenue Percentage, On Target Rate, and Average Engagement from validated matched records plus governed settings metadata in server-side persistent snapshots.

**Rationale**:
- Constitution Principle I requires reproducible, auditable metrics; architecture and EPIC-007 story contracts define these formulas and policy controls.
- Server-side calculation ensures traceability and consistency across time.
- Governed settings from `app.AdoptionSettings` and rule-context snapshots provide auditability.

**Alternatives Considered**:
- **Calculate directly in UI from raw fields**: Rejected due to traceability and consistency risk.
- **Derive from unvalidated staging data**: Rejected due to integrity violations per Constitution Principle I.

---

## R2 — Snapshot Persistence Semantics

**Task**: Research whether metric snapshots should be immutable append-only records or mutable upserts with point-in-time retention.

**Decision**: Persist append-only immutable snapshot records per successful run and application scope, including run id, calculation timestamp, and metric-definition metadata.

**Rationale**:
- Supports trend history, auditability, and deterministic replay interpretation.
- Immutable append-only semantics prevent loss of historical lineage.
- Each run produces one snapshot; snapshots are never updated or deleted.

**Alternatives Considered**:
- **Upsert latest snapshot in place**: Rejected because historical lineage is lost and audit trail is compromised.
- **Persist without metadata/version context**: Rejected due to governance ambiguity when rules change between runs.

---

## R3 — Rule-Context Traceability

**Task**: Research how to maintain reproducibility of historical snapshots when denominator and adoption settings change.

**Decision**: Tie each metric snapshot to the run-specific filter/adoption context snapshot captured at calculation time via `app.FilterRuleSnapshots`.

**Rationale**:
- Required to explain KPI differences across runs when business rules/settings change.
- Point-in-time rule snapshots enable deterministic replay of past runs.
- Prevents confusion when comparing snapshots taken under different configuration contexts.

**Alternatives Considered**:
- **Reference only current active settings**: Rejected because historical runs become non-reproducible when rules evolve.
- **No context snapshots**: Rejected due to Governor audit and compliance risk.

---

## R4 — Interim Investment Dummy Data Strategy

**Task**: Research approach for providing synthetic investment data to unblock KPI development before authoritative EPIC-BQM-013 investment onboarding.

**Decision**: Provide deterministic idempotent synthetic investment facts in SQL (`app` schema) with explicit non-authoritative marking (`IsSynthetic = 1`).

**Rationale**:
- Unblocks KPI and contract development before EPIC-BQM-013 authoritative investment source onboarding (dependency unblocked).
- Deterministic seeding ensures test reproducibility.
- Explicit `IsSynthetic` flag prevents accidental use in production contexts.

**Alternatives Considered**:
- **Skip interim investment support**: Rejected due to blocked downstream KPI integration activities and test isolation requirements.
- **Use non-deterministic random seeding**: Rejected due to test instability and audit inconsistency.
- **Defer to manual test fixtures**: Rejected due to maintainability overhead and scale limitations.

---

## R5 — Access and Retrieval Scope

**Task**: Research authorization boundaries for metric snapshot retrieval in multi-application and multi-role context.

**Decision**: Enforce server-side role/application scoped metric retrieval with non-production-only exposure for synthetic investment values.

**Rationale**:
- Constitution Principle V and stakeholder security requirements mandate strict RBAC controls.
- Non-admin users should see metrics only for assigned applications.
- Synthetic investment values pose governance risk if exposed in production.

**Alternatives Considered**:
- **Client-side filtering only**: Rejected due to potential unauthorized data exposure and trust boundary violation.
- **Expose synthetic and authoritative values without distinction**: Rejected due to governance risk and accidental production use.
- **No scope restrictions**: Rejected due to security architecture requirement.

---

## R6 — Architecture Boundary

**Task**: Research which application layer (route, service, domain, adapter) should own KPI orchestration, contracts, and persistence.

**Decision**: Keep KPI orchestration in `core/application`, contracts in `core/domain`, and persistence in `infrastructure/persistence` adapters.

**Rationale**:
- Constitution Principle VII and existing project structure (from EPIC-BQM-006 validation pipeline) require clean architecture separation.
- Separation of concerns enables independent testing and maintainability.
- Existing runtime repository selection in `infrastructure/persistence/runtime` supports both SQL and in-memory test adapters.

**Alternatives Considered**:
- **Implement logic directly in route handlers**: Rejected due to coupling and maintainability risk.
- **Duplicate repository contracts across layers**: Rejected due to single-source contract rule.
- **Monolithic service layer**: Rejected due to lack of domain/infrastructure isolation.

---

## R7 — Denominator Snapshot Load: ADF Pipeline vs. Local Manual Load

**Task**: Research how `stage.DenominatorSnapshot` should be populated from the external Mercury-managed SQL view (`[InventoryAnalysis].[dbo].[vw_USTaxBTS_FY26_MaxACD]`), given that the application database cannot query the external server directly.

**Decision**: In production/Azure, a dedicated ADF pipeline (`PL_DenomLoad_Weekly`) runs on a weekly schedule and is fully independent from the validation/metrics pipeline. In local development, the snapshot is populated manually (e.g., via seed script or direct import) — no local ADF runtime is required.

**Rationale**:
- The external Mercury server is independently managed (assumption A25) — no linked-server or `OPENROWSET` from the ATTG_Usage database is available or safe to assume.
- ADF is the only component that bridges external Mercury connectivity; the application database never queries the external server directly.
- Decoupling denominator load from the validation pipeline allows the load schedule to vary (weekly) independently of when engagements are processed.
- Local manual population avoids requiring a full ADF runtime for development and test workflows.

**Alternatives Considered**:
- **Real-time query via linked server at pipeline runtime**: Rejected — assumption A25 explicitly states cross-server connectivity cannot be assumed; also creates runtime dependency on external server availability.
- **Per-run copy from external server**: Rejected — too slow, hammers the external server, and unnecessary given weekly cadence.
- **Shared Synapse or federated query**: Rejected — A2 confirms single Azure SQL instance is sufficient for MVP.

**ADF Pipeline Definition — `PL_DenomLoad_Weekly`**:

```
Trigger  : Weekly ADF schedule trigger (independent of PL_MetricsProcessing)
Scope    : Global — loads denominator data for all applications in one batch
Owner    : Platform / Data Engineering (not gated by application pipeline runs)

Step 1 — Copy Activity
  Source : External Mercury SQL Server view
           [InventoryAnalysis].[dbo].[vw_USTaxBTS_FY26_MaxACD]
           via ADF Linked Service with dedicated service principal credentials
           (Option B: direct SQL source when connectivity permits)
           (Option A fallback: Excel report from Azure Blob / SFTP — skipRows=6)
  Sink   : stage.DenominatorSnapshot in ATTG_Usage database
           Write mode: TRUNCATE + bulk insert (full weekly replacement)
  Config : Column mappings to standard naming convention
  Note   : ADF is the sole component that connects to the external Mercury
           server — application stored procedures never call it directly.

Step 2 — Stored Procedure Activity
  Exec   : [stage].[usp_RefreshDenominatorLocal]
  Purpose: Coerce data types (TRY_CAST for numeric/date columns),
           deduplicate within stage.DenominatorSnapshot,
           app.vw_DenominatorLocal auto-refreshes (SELECT over stage table)
  Output : Populated stage.DenominatorSnapshot + refreshed app.vw_DenominatorLocal

Step 3 — Validation Activity (optional, recommended)
  Check  : Row count > 0 after load
  OnFail : Fail pipeline; send alert — do not leave stale or empty snapshot
```

**Local Development Substitute**:

```
No ADF runtime required locally.
Population method: manual seed script or direct SSMS import.

Recommended approach:
  1. Export vw_USTaxBTS_FY26_MaxACD to CSV from a Mercury-accessible environment.
  2. Import via SSMS Import Wizard or bcp into stage.DenominatorSnapshot.
  3. Run [stage].[usp_RefreshDenominatorLocal] manually to coerce types and refresh view.

The local workflow is intentionally ungated — developers are responsible for
ensuring a representative denomination snapshot exists before running pipeline tests.
```

**Pipeline Independence**:
- `PL_DenomLoad_Weekly` has no dependency on `PL_MetricsProcessing` or `PL_MetricsOrchestrator`.
- Validation/metrics pipelines consume `app.vw_DenominatorLocal` (the stable view over the local snapshot), never the external source.
- If the weekly load has not run, pipelines operate on the previous week's snapshot — reflected in `PipelineRuns.SnapshotDate`.

---

## R8 — Pipeline Execution Trigger: Data Ingestion vs. Rule Changes

**Task**: Determine when `PL_MetricsProcessing` should be triggered — after numerator data is ingested, after filter rules (numerator or denominator) are updated, or both — and whether rule changes should trigger any form of pipeline run.

**Decision**: The pipeline is triggered by two events only:

1. **After numerator ingestion** (`triggerSource = "API"`): Triggered automatically (fire-and-forget) by the numerator ingestion API route after a successful batch insert into `stage.EngagementUsageRaw`. This is the primary automated trigger path.
2. **Scheduled orchestration** (`triggerSource = "ADF"`): ADF `PL_MetricsOrchestrator` runs on a defined schedule to ensure metrics are periodically recalculated across all active applications.

**Rule changes (numerator or denominator filter rules) do NOT trigger any pipeline run** — neither automatic nor manual. Rule updates change how existing staged data is classified; they do not produce new data and must not overwrite the persisted metric history without a corresponding ingestion event or scheduler run.

**Rationale**:
- Auto-triggering after ingestion aligns with the architecture doc (`PL_MetricsProcessing` trigger: "On-demand after numerator ingestion") and ensures metrics are always current after new data arrives.
- Rule changes affect classification logic, not the underlying staged dataset. Triggering a pipeline run on every rule save would silently modify the persisted KPI trend without a clear data event, making metric history unreliable.
- Computing a live KPI preview directly from rule changes (without persisting results) is the correct approach for rule impact evaluation — but this is a distinct feature from the pipeline itself and is deferred to a future release (see below).
- The `triggerSource` column in `app.PipelineRuns` makes the trigger cause auditable for every run.

**`TriggerSource` Values and Trigger Paths**:

| `TriggerSource` | When | Initiated By |
|-----------------|------|--------------|
| `"API"` | After numerator ingestion batch completes | Ingestion API route (automated, fire-and-forget) |
| `"ADF"` | Scheduled orchestration | ADF `PL_MetricsOrchestrator` schedule trigger |

> `"Manual"` is reserved as a valid enum value in `app.PipelineRuns.TriggerSource` for operational use (e.g., ad-hoc admin re-runs via direct API call) but is not surfaced as a user-facing action tied to rule saves.

**Alternatives Considered**:
- **Auto-trigger on every rule save**: Rejected — silently mutates persisted metric history on a configuration change; violates audit expectations and creates uncontrolled compute load during iterative rule tuning.
- **Manual trigger surfaced in UI after rule save**: Rejected for this epic — deferred to the Preview feature (see below); the current scope does not include a rule-change-driven recalculation path.
- **Scheduled trigger only (no ingestion auto-trigger)**: Rejected — metrics would lag behind ingestion by up to one full schedule interval; architecture doc confirms ingestion is a trigger event.

**Preview Feature (Out of Scope for EPIC-BQM-007 — Deferred to Future Release)**:

When a user updates denominator or numerator filter rules, they should be able to see how those changes would affect the KPI values *before* committing a real pipeline run. This "rule impact preview" capability:

- Generates a **transient, non-persisted** KPI preview using proposed rule changes applied to the current `stage.DenominatorSnapshot` and `stage.EngagementUsageRaw` data.
- Does NOT write to `app.MetricSnapshots`, `app.PipelineRuns`, or any other durable table.
- Returns preview values inline in the rule configuration UI without creating a run record.
- Is functionally similar to the existing `DenominatorImpactPreview` transient entity already defined in EPIC-BQM-006 (`006-denominator-rules-config/data-model.md`), which previews denominator population count/revenue impact — the future feature extends this to full KPI values.

This preview feature is explicitly **out of scope for EPIC-BQM-007** and will be specified and implemented in a future EPIC.
