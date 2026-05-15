# Feature Specification: Metrics Calculation Dashboard

**Feature Branch**: `008-metrics-calculation-dashboard`  
**Created**: 2026-05-06  
**Status**: Draft  
**Input**: User description: "work on epic-007-metrics-calculation-dashboard don't create an new branch, the current branch is the branch for that epic. Also, you don't need to create a new spec folder in specs/, use the existing specs/008-metrics-calculation-dashboard/ folder"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Calculate Core and Expanded KPIs (Priority: P1)

As a data operations stakeholder, I want each completed processing run to calculate governed KPI outputs per application, so adoption performance can be measured consistently and reproducibly.

**Why this priority**: KPI calculation is the primary business outcome of EPIC-BQM-007 and is required before any downstream consumption has value.

**Independent Test**: Run one completed processing cycle for one application and confirm calculated outputs include Adoption Percentage, Revenue Percentage, On Target Rate, and Average Engagement with valid denominator handling.

**Acceptance Scenarios**:

1. **Given** filtered denominator and matched numerator inputs exist for an application, **When** metric calculation runs, **Then** Adoption Percentage and Revenue Percentage are calculated according to configured adoption and revenue-basis rules.
2. **Given** threshold and aggregation policy inputs are available, **When** KPI expansion calculation runs, **Then** On Target Rate and Average Engagement are calculated deterministically for the run scope.
3. **Given** denominator count or value is zero, **When** KPI calculation executes, **Then** divide-by-zero is handled safely and output remains valid for audit and display.

---

### User Story 2 - Persist Auditable Historical Snapshots (Priority: P2)

As a reporting owner, I want every successful calculation run stored as an immutable historical snapshot, so trend analysis and audit traceability remain reliable.

**Why this priority**: Historical snapshot persistence is required to prove lineage and explain KPI changes over time.

**Independent Test**: Execute two runs for one application and verify two distinct immutable snapshots are stored with run traceability, rule-context references, and metric metadata.

**Acceptance Scenarios**:

1. **Given** a successful KPI calculation run, **When** persistence executes, **Then** one snapshot record is stored with application, run id, calculation timestamp, KPI values, and required metadata fields.
2. **Given** snapshot persistence completes, **When** run lifecycle updates occur, **Then** run status transitions to completed only after snapshot write success.
3. **Given** rule configuration changes between runs, **When** historical snapshots are queried, **Then** each snapshot remains traceable to the applicable rule context at calculation time.

---

### User Story 3 - Provide Interim Investment Dummy Dataset (Priority: P3)

As a data engineer, I want a deterministic interim investment dummy dataset available in SQL, so non-production KPI development can proceed until authoritative investment onboarding is delivered.

**Why this priority**: EPIC-BQM-007 explicitly includes interim synthetic investment data to unblock KPI and contract work before EPIC-BQM-013.

**Independent Test**: Run the seed process twice and verify synthetic investment records exist, are labeled non-authoritative, and remain idempotent without duplicate business keys.

**Acceptance Scenarios**:

1. **Given** interim investment seed execution runs, **When** records are generated, **Then** rows are stored with synthetic-data designation and traceable run metadata.
2. **Given** synthetic records exist, **When** authorized consumers request non-production metric context, **Then** interim investment values are retrievable with clear non-authoritative labeling.
3. **Given** repeat seed execution for the same scope, **When** processing completes, **Then** no duplicate synthetic records are created for the same key and date.

### Edge Cases

- Required adoption settings are missing or invalid for an application at calculation time.
- Processing run fails after validation but before snapshot persistence.
- Re-run occurs for the same application window with different active rule sets.
- Synthetic investment dataset is requested where no seeded records exist for scope/date.
- KPI metadata fields are missing at write-time and would break traceability requirements.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST calculate Adoption Percentage for each successful processing run using matched numerator counts over filtered denominator counts.
- **FR-002**: The system MUST calculate Revenue Percentage for each successful processing run using matched numerator revenue over filtered denominator revenue.
- **FR-003**: The system MUST calculate On Target Rate using approved threshold policy definitions.
- **FR-004**: The system MUST calculate Average Engagement using approved deterministic aggregation rules for the selected run scope.
- **FR-005**: The system MUST apply per-application adoption-level and revenue-basis configuration when computing KPI outputs.
- **FR-006**: The system MUST persist one immutable metric snapshot per successful run and application scope.
- **FR-007**: The system MUST persist run traceability metadata with each snapshot, including run identifier and calculation timestamp.
- **FR-008**: The system MUST persist metric-definition metadata required for KPI governance and audit interpretation.
- **FR-009**: The system MUST persist rule-context references so each snapshot can be interpreted against the active configuration at calculation time.
- **FR-010**: The system MUST set run status to completed only after snapshot persistence succeeds.
- **FR-011**: The system MUST generate interim investment dummy data in SQL with explicit synthetic-data designation.
- **FR-012**: The system MUST keep synthetic investment seed behavior deterministic and idempotent for repeated executions.
- **FR-013**: The system MUST allow authorized non-production consumers to retrieve interim investment dummy values as non-authoritative context.

### Key Entities *(include if feature involves data)*

- **Processing Run**: One end-to-end execution context with lifecycle state, start/end timestamps, and summary counts.
- **Metric Snapshot**: Immutable persisted KPI output record for one run and application scope, including counts, percentages, and metadata.
- **Metric Definition Metadata**: Governance context attached to KPI outputs, including version and refresh/source identifiers.
- **Filter Rule Context Snapshot**: Captured configuration state used at calculation time for audit reproducibility.
- **Interim Investment Dummy Fact**: Synthetic, non-authoritative investment record used for non-production KPI development until authoritative source onboarding is complete.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of successful runs produce one persisted immutable metric snapshot per application scope.
- **SC-002**: 100% of persisted snapshots include run identifier, calculation timestamp, and metric-definition metadata.
- **SC-003**: For agreed benchmark datasets, KPI outputs (Adoption, Revenue, On Target Rate, Average Engagement) match expected values within 0.1 percentage points.
- **SC-004**: 100% of snapshot records remain traceable to active rule context and originating run.
- **SC-005**: Repeated interim investment seed executions produce no duplicate synthetic records for identical business key and date.
- **SC-006**: Non-production consumers can retrieve interim investment context in under 3 seconds for standard scope requests.

## Assumptions

- Upstream validation and matching outputs are available and trusted as inputs to KPI calculation.
- Application-level adoption settings and revenue-basis configuration exist before calculation execution.
- **Metric Clipping**: Adoption percentage and revenue percentage are clipped to [0, 100] range to ensure valid percentage representation.
- **On Target Threshold**: Default policy is 70% engagement threshold (`engagement > 70%`) unless an approved policy version overrides it.
- **Revenue Basis**: Selection between FYTD (Fiscal Year To Date) and ETD (Engagement To Date) is controlled per application via `AdoptionSettings.RevenueMetric`.
- Interim investment dummy data is restricted to non-production usage and is never treated as authoritative source-of-record data.
- Dashboard composition and grouping behavior remain out of scope for this feature and are covered by EPIC-BQM-014.
