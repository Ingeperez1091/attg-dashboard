# BQM-US024 — Store Historical Metric Snapshots

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-007 (Metrics Calculation and Interim Investment Dummy Data)  
> **Priority**: 1 — Critical | **Phase**: Extended-MVP A  
> **Changelog**: v2.0.0 — Story aligned to EPIC-BQM-007 split and metric persistence scope.

---

### :bust_in_silhouette: User Story

**As a** data consumer  
**I want to** have every metric run persisted as an auditable snapshot  
**So that** trend analysis and run-level traceability are reliable.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** a successful metric calculation, **When** persistence executes, **Then** a row is inserted into `app.MetricSnapshots` with run and count fields required by the KPI contract.
- **Given** a snapshot write succeeds, **When** rule capture executes, **Then** active filter rule context is persisted for audit traceability.
- **Given** snapshot and filter writes complete, **When** pipeline finalization executes, **Then** run status is set to completed with end timestamp.
- **Given** repeated runs for one application, **When** queried, **Then** each run is represented as a distinct immutable snapshot.
- **Given** historical snapshots are queried, **When** sorted, **Then** ordering by calculation timestamp is supported.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK089] Persist run snapshots in `app.MetricSnapshots` with pipeline and metric fields
- [ ] [BQM-TK090] Persist filter-rule context and finalize `app.PipelineRuns` status updates
- [ ] [BQM-TK091] Add tests for append-only behavior and chronological retrieval

### :link: Links

- **Epic:** EPIC-BQM-007 (`Documentation/Backlog/epics/epic-007-metrics-calculation-dashboard.md`)
- **Architecture:** `Documentation/ProjectSpecifications/architecture.md` — Sections 4.4, 5.3
- **Assumptions:** `Documentation/ProjectSpecifications/assumptions.md`
- **Sprint:** (Assign via Milestone)

### Business Rules

- Snapshots are immutable and append-only.
- Snapshot/rule persistence must remain consistent with pipeline run lifecycle status.

### Data Impact & Pipelines

- **Writes:** `app.MetricSnapshots`, `app.FilterRuleSnapshots`, `app.PipelineRuns`.
- **Source for:** Dashboard rendering, historical trend analysis, and audit evidence.
