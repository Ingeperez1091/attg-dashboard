# Feature Specification: Validation Processing Pipeline

**Feature Branch**: `[007-validation-processing-pipeline]`  
**Created**: 2026-04-16  
**Status**: Ready  
**Input**: User description: "epic-006-validation-processing-pipeline"

## User Scenarios & Testing *(mandatory)*


### User Story 1 — Validate Numerator Records Against the Filtered Denominator (Priority: P1)

As a **data pipeline operator**, I need the system to automatically validate staged numerator records by checking their Engagement IDs or Client IDs against the locally materialized denominator snapshot, so that only legitimate, matchable records proceed to metric calculation and invalid IDs are caught early.

**Why this priority**: Without denominator validation, adoption percentages cannot be trusted. This is the single most critical data-quality gate in the entire pipeline and is a prerequisite for every downstream step. The denominator view lives on an external Mercury-managed server that the application database cannot query directly — validation operates exclusively against the local weekly snapshot.

**Independent Test**: Can be fully tested by ingesting a known set of numerator records (some with valid IDs in the local denominator snapshot, some with invalid IDs, some with null/empty IDs) and verifying that each record is correctly flagged as valid or invalid with appropriate error context.

**Acceptance Scenarios**:

1. **Given** staged numerator records exist in the staging table for an application, **When** the validation pipeline runs, **Then** each record's Engagement ID or Client ID is checked against the locally materialized denominator snapshot and marked as matched or unmatched.
2. **Given** a numerator record contains an ID that does not exist in the local denominator snapshot, **When** validation completes, **Then** the record is flagged as invalid and an error context message is persisted (e.g., "Engagement ID 12345 not found in denominator").
3. **Given** a numerator record contains an ID that exists in the local denominator snapshot, **When** validation completes, **Then** the record is marked as valid and eligible for filtering.
4. **Given** duplicate numerator records for the same ID exist in the staging table, **When** validation runs, **Then** duplicates are detected (keeping only the latest by stage record ordering) and flagged; only one record per unique ID is promoted.
5. **Given** a numerator record has a null or empty Engagement/Client ID, **When** validation runs, **Then** the record is flagged as invalid with error context "Missing Engagement/Client ID".

---

### User Story 2 — Apply Denominator Filter Rules Per Application (Priority: P1)

As a **data pipeline operator**, I need the system to apply the configured denominator filter rules for each application to the local denominator snapshot, so that the addressable population (denominator count) reflects only the engagements or clients that meet the business criteria before any numerator validation happens.

**Why this priority**: Denominator filtering directly determines the "addressable population" — the divisor in the adoption percentage formula. It MUST happen before numerator ID validation, because IDs are validated against the **filtered** denominator, not the raw snapshot. Incorrect denominator counts produce misleading adoption rates. This is co-priority with numerator validation because the filtered denominator is a prerequisite for ID validation.

**Independent Test**: Can be tested by configuring denominator rules for an application (e.g., Service Code = 11420, Release Date > 01/01/2025, exclude name patterns), running the pipeline against the local denominator snapshot, and verifying that the resulting addressable population exactly matches the expected filtered set.

**Acceptance Scenarios**:

1. **Given** an application has denominator filter rules configured (service codes, date ranges, statuses, revenue thresholds, name inclusion/exclusion patterns, account channel), **When** the pipeline processes the local denominator snapshot, **Then** the addressable population includes only records satisfying all rules (AND-combined).
2. **Given** an application has no denominator filter rules configured, **When** the pipeline runs, **Then** the full local denominator snapshot is used as the addressable population.
3. **Given** denominator rules have changed since the last pipeline run, **When** the pipeline runs, **Then** it uses the current rule configuration and recomputes the addressable population accordingly.
4. **Given** the denominator rules produce zero matching records, **When** the pipeline runs, **Then** the pipeline reports "empty denominator" and completes gracefully rather than producing a division-by-zero error.
5. **Given** Maestro has 5 denominator rules (ServiceCode=11420, ReleaseDate>2025-01-01, name exclusion patterns, Revenue≠0, Status IN Closing/Completed/Pre-Closing/Released), **When** the pipeline runs for Maestro, **Then** all 5 rules are applied sequentially as AND-combined predicates against the local snapshot.

---

### User Story 3 — Apply Numerator Filter Rules Per Application (Priority: P2)

As a **data pipeline operator**, I need the system to apply the configured numerator filter rules for each application to the validated numerator records, so that only records meeting the application-specific criteria contribute to adoption metrics.

**Why this priority**: Numerator filter rules (configured by application owners via the UI) directly control which records count toward adoption. Without applying them, metrics would include records that the business has explicitly excluded. Depends on denominator filtering and ID validation being in place first.

**Independent Test**: Can be tested by configuring filter rules for an application (e.g., Region = US, Budget >= 20000), ingesting numerator records that both pass and fail those rules, and verifying that only passing records are promoted.

**Acceptance Scenarios**:

1. **Given** an application has numerator filter rules configured (field-operator-value expressions referencing fields declared in the application model), **When** the pipeline processes validated records for that application, **Then** only records satisfying all filter rules (AND-combined) are retained.
2. **Given** an application has no numerator filter rules configured, **When** the pipeline processes validated records, **Then** all validated records pass through without filtering.
3. **Given** a numerator record fails one or more filter rules, **When** the pipeline completes, **Then** the record is excluded from downstream metric calculation and the specific rule that rejected it is recorded.

---

### User Story 4 — Match Numerator to Filtered Denominator (Priority: P1)

As a **data pipeline operator**, I need the system to match filtered numerator records against the filtered denominator population, so that matched records represent the adoption numerator and are ready for metric calculation.

**Why this priority**: The intersection of numerator and denominator is the core adoption measurement. Without matching, neither engagement-level nor client-level adoption counts can be computed.

**Independent Test**: Can be tested by providing a known denominator set and a known numerator set, running the matching step, and verifying the intersection contains exactly the expected matched records and counts.

**Acceptance Scenarios**:

1. **Given** filtered numerator records and a filtered denominator population for an application, **When** the matching step runs, **Then** the system identifies all records where the numerator ID exists in the filtered denominator population.
2. **Given** an application measures engagement-level adoption (Maestro, Vector, Navigate), **When** matching runs, **Then** records are matched on Engagement ID.
3. **Given** an application measures client-level adoption (EYST, Prodigy), **When** matching runs, **Then** records are matched on Client ID (distinct clients).
4. **Given** matched records exist, **When** matching completes, **Then** the matched set is persisted with the pipeline run reference and available for metric calculation.

---

### User Story 5 — Persist Validation Results With Error Context (Priority: P2)

As a **data pipeline operator**, I need every validation result (success or failure) to be persisted with clear error context, so that users can review what passed, what failed, and why.

**Why this priority**: Transparency of validation results is essential for trust in the data. Silently discarding records would violate the constitution's Data Integrity principle.

**Independent Test**: Can be tested by running the pipeline on a mix of valid and invalid records and querying the validation results to confirm each record has a status and, where applicable, an error message.

**Acceptance Scenarios**:

1. **Given** the pipeline has validated a batch of numerator records, **When** validation completes, **Then** a validation result record is persisted for every input record, including status (valid/invalid/duplicate/filtered-out) and a human-readable error message for non-valid records.
2. **Given** a user wants to understand why a specific record was excluded, **When** they look up the validation results, **Then** the error context clearly states the reason (e.g., "ID not found in denominator", "Failed filter rule: Budget >= 20000", "Duplicate of record X", "Missing Engagement/Client ID").
3. **Given** a pipeline run completes, **When** validation results are persisted, **Then** each result is linked to its pipeline run identifier for traceability.

---

### User Story 6 — Surface Validation Errors to Users (Priority: P3)

As an **application owner**, I need to see a summary of validation errors for my application's most recent pipeline run, so that I can correct source data or adjust filter rules if needed.

**Why this priority**: While validation results must be persisted (P2), surfacing them to users via the dashboard is the final step that closes the feedback loop. It can be delivered after core pipeline logic is in place.

**Independent Test**: Can be tested by triggering a pipeline run that produces validation errors and verifying that the user can view a summary of errors grouped by error type for their assigned applications only.

**Acceptance Scenarios**:

1. **Given** the pipeline has completed and validation errors exist for an application, **When** an application owner or administrator views the validation results, **Then** they see a summary showing total records processed, total valid, total invalid, total filtered-out, and a breakdown of error types.
2. **Given** validation errors exist, **When** a user views the error details, **Then** they can see individual records that failed with their specific error context and the pipeline run date.
3. **Given** no validation errors exist for an application's latest run, **When** a user views the validation summary, **Then** they see a confirmation that all records passed validation.
4. **Given** a non-administrator user views validation results, **When** they have access to specific applications only, **Then** they see results only for their assigned applications (role-scoped visibility).

---

### User Story 7 — Asynchronous Pipeline Execution With Run Tracking (Priority: P1)

As a **system user**, I need the validation pipeline to run asynchronously without blocking my browser session, with full run tracking metadata, so that the dashboard remains responsive while data is being processed and I can audit any pipeline execution.

**Why this priority**: The pipeline processes potentially thousands of records. Blocking the user session would make the application unusable during processing and violate the constitution's performance requirements. Run tracking is essential for auditability (constitution Principle I).

**Independent Test**: Can be tested by triggering a pipeline run and verifying the user can continue using the dashboard immediately, with pipeline status and run metadata available on demand.

**Acceptance Scenarios**:

1. **Given** new numerator data has been staged, **When** the pipeline is triggered, **Then** the system processes records asynchronously and the user's session is not blocked.
2. **Given** the pipeline is running, **When** a user checks the pipeline status, **Then** they see the current state (queued, processing, completed, failed).
3. **Given** the pipeline completes, **When** the user next views the relevant application data, **Then** the results reflect the latest processed data.
4. **Given** a pipeline run finishes (success or failure), **When** run metadata is inspected, **Then** it includes: start time, end time, application processed, total records in, valid count, invalid count, duplicate count, filtered-out count, matched count, and the trigger source.

---

### Edge Cases

- **Empty denominator**: When the local denominator snapshot contains zero records for an application after filtering, the pipeline must report "empty denominator" rather than produce a division-by-zero or 0% metric.
- **All records invalid**: When every numerator record fails validation, the pipeline must complete successfully, report 0 matched records, and surface all validation errors — not crash or hang.
- **Re-ingestion / duplicate data**: When the same numerator data is ingested twice, duplicate detection (by match key, keeping latest by stage ordering) must prevent double-counting without losing the newer submission's metadata.
- **Rule change mid-run**: The pipeline must snapshot the active filter rules at the start of execution and apply them consistently throughout the run, ignoring any configuration changes that occur during processing.
- **Denominator snapshot unavailable or empty**: If the local denominator snapshot is empty (e.g., weekly load hasn't run yet or failed), the pipeline must fail gracefully with a clear error message and allow retry — not silently produce 0% metrics.
- **Null or empty IDs**: A numerator record with a null or empty Engagement/Client ID must be flagged as invalid with error context "Missing Engagement/Client ID".
- **Data type coercion failures**: When a numeric field cannot be parsed, it becomes null (not an error exit). When a date field cannot be parsed, it becomes null. String fields are trimmed. These follow `errors='coerce'` semantics per the constitution.
- **External Mercury server unreachable**: The pipeline itself is **not** affected — it always operates on the local `stage.DenominatorSnapshot`. However, if `PL_DenomLoad_Weekly` fails, the local snapshot may be stale; the pipeline should include the snapshot date in its run metadata for transparency.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The pipeline MUST read new, unprocessed records from the numerator staging table for the target application.
- **FR-002**: The pipeline MUST parse JSON payloads from staged records into individual field-level records, using the application's declared field structure (field names, types, and source paths from the application model metadata).
- **FR-003**: The pipeline MUST apply the application's configured denominator filter rules to the local denominator snapshot to derive the addressable population (filtered denominator), using all supported filter types: service code (IN/EQ), release date (GT), engagement status (IN/NOT_IN), revenue threshold (GT/NEQ), name exclusion (NOT_CONTAINS), name inclusion (CONTAINS), and account channel (EQ).
- **FR-004**: The pipeline MUST validate each numerator record's Engagement ID or Client ID against the filtered denominator (not the raw snapshot), determining match or no-match. The match key type is determined by the application's adoption-level setting (Engagement ID for engagement-level apps, Client ID for client-level apps).
- **FR-005**: The pipeline MUST detect and flag duplicate numerator records within the same ingestion batch, keeping only the latest record per unique match key (by stage record ordering).
- **FR-006**: The pipeline MUST apply data type coercion rules consistently during JSON parsing: numeric fields coerced with parse-failure-as-null semantics, date fields coerced with invalid-as-null semantics, string fields trimmed and normalized.
- **FR-007**: The pipeline MUST apply the application's configured numerator filter rules (field-operator-value expressions, AND-combined, referencing fields declared in the application model metadata) to validated records, retaining only those that satisfy all rules. Records failing a rule MUST be marked with the specific rule that rejected them.
- **FR-008**: The pipeline MUST perform the numerator-denominator intersection (matching), joining records by Engagement ID for engagement-level applications (Maestro, Vector, Navigate) and by Client ID (distinct clients) for client-level applications (EYST, Prodigy).
- **FR-009**: The pipeline MUST persist the matched record set for downstream metric calculation, linked to the pipeline run.
- **FR-010**: The pipeline MUST persist a validation result for every processed record, including a status (valid, invalid, duplicate, filtered-out) and a human-readable error message when applicable, linked to the pipeline run.
- **FR-011**: The pipeline MUST preserve raw data in the staging table — it MUST NOT modify or delete staged records in place.
- **FR-012**: The pipeline MUST execute asynchronously without blocking user sessions.
- **FR-013**: The pipeline MUST provide a way for users to check the current run status (queued, processing, completed, failed).
- **FR-014**: The pipeline MUST surface validation error summaries to users, grouped by error type, including counts and individual record details, scoped by the user's application access.
- **FR-015**: The pipeline MUST snapshot the active numerator and denominator filter rules at the beginning of each run and apply them consistently for the duration of that run, persisting the snapshot for auditability.
- **FR-016**: The pipeline MUST handle empty denominators gracefully by reporting the condition ("empty denominator for application X") rather than producing invalid metrics or a crash.
- **FR-017**: The pipeline MUST record metadata for each run: start time, end time, application processed, total records in, valid count, invalid count, duplicate count, filtered-out count, matched count, and the trigger source.
- **FR-018**: The pipeline MUST operate exclusively on the local denominator snapshot — it MUST NOT query the external Mercury server directly. The local snapshot is maintained by a separate weekly load process.
- **FR-019**: The pipeline MUST process one application per execution, parameterised on application identity, to maintain isolation and simplify error handling. A separate orchestration mechanism invokes the pipeline for each active application.

### Key Entities *(include if feature involves data)*

- **Pipeline Run**: A single per-application execution with status, timestamps, trigger source, and summary counts.
- **Validation Result**: Record-level processing outcome for staged numerator data with status and reason context linked to a Pipeline Run.
- **Matched Record**: A validated numerator record that satisfies active rules and matches the filtered denominator population.
- **Addressable Population**: Filtered denominator set derived from active denominator rules for the target application.
- **Filter Rule Snapshot**: Point-in-time numerator and denominator rule capture used for one run.
- **Local Denominator Snapshot**: Weekly materialized denominator source used by processing runs.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of processing runs persist a completed or failed lifecycle outcome with timestamps and summary counts.
- **SC-002**: At least 95% of single-application runs with up to 100,000 staged records complete within 15 minutes under normal conditions.
- **SC-003**: 100% of invalid, duplicate, unmatched, or rule-excluded records are persisted with explicit reason context.
- **SC-004**: 100% of matched outcomes are traceable to both application and Pipeline Run.
- **SC-005**: 100% of runs preserve staged source data unchanged.
- **SC-006**: In coordinated cycles, at least 99% of active applications receive an independent run outcome even if peer runs fail.
- **SC-007**: Authorized users can review validation summary outcomes within 5 minutes of run completion.
- **SC-008**: 100% of unauthorized attempts to trigger processing or view outcomes are denied by role and application scope.

## Assumptions

- The external Mercury denominator view (`[InventoryAnalysis].[dbo].[vw_USTaxBTS_FY26_MaxACD]`) resides on an independent, Mercury-managed SQL Server that may not be directly accessible from the application database (architecture assumption A25). The pipeline operates exclusively on the local materialized copy (`stage.DenominatorSnapshot` / `app.vw_DenominatorLocal`), refreshed weekly by a separate load process.
- The local denominator snapshot is maintained and refreshed weekly by a separate ADF pipeline (`PL_DenomLoad_Weekly`) prior to pipeline execution. Staleness of the local snapshot is a concern for data quality but is outside the scope of this feature.
- The numerator staging table (`stage.EngagementUsageRaw`) is populated by the existing Numerator Ingestion API (EPIC-BQM-003) prior to pipeline execution.
- Numerator filter rules are already configurable through the application (EPIC-BQM-004) and stored in the database, referencing fields declared in the application model metadata.
- Denominator filter rules are already configurable through the application (EPIC-BQM-008) and stored in the database, referencing columns declared in the shared denominator model metadata.
- The five applications in scope (Maestro, EYST, Prodigy, Vector, Navigate) and their adoption-level settings (engagement-level vs. client-level) are seeded in the database via `AdoptionSettings`.
- The pipeline processes one application per run to maintain isolation. An orchestrator invokes the pipeline per active application with configurable concurrency.
- Metric calculation and storage (computing adoption percentages from matched records) is out of scope for this feature and handled by EPIC-BQM-007.
- The CI pipeline (EPIC-BQM-010) is already established on protected trunk branches before this feature's source-code development begins.
- Application-specific classification fields (e.g., InMaestro, EYSTActive, NavigateStatus) come from the numerator JSON payload, not from external sources (architecture assumption A23).
- Denominator filter rules from the notebooks are used as seed defaults; application owners can modify them through the configuration UI (architecture assumption A24).
- CI quality gates (lint, type-check, and automated tests) remain enforced on protected branches.
