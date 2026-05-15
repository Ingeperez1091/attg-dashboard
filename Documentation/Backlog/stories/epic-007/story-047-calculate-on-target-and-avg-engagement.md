# BQM-US047 - Calculate On Target Rate and Average Engagement Metrics

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-007 (Metrics Calculation and Interim Investment Dummy Data)  
> **Priority**: 2 - High | **Phase**: Extended-MVP A  
> **Changelog**: v1.0.0 - New story for KPI expansion aligned with stakeholder dashboard contract.

---

### :bust_in_silhouette: User Story

**As a** reporting consumer  
**I want to** receive On Target Rate and Average Engagement metrics from governed calculations  
**So that** dashboard KPI cards reflect complete portfolio performance context.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** metric snapshots are generated for scoped applications, **When** KPI expansion logic executes, **Then** On Target Rate is calculated using approved threshold policy.
- **Given** matched and denominator records, **When** aggregation runs, **Then** Average Engagement is calculated with deterministic aggregation rules.
- **Given** KPI outputs are persisted, **When** APIs return metric payloads, **Then** definition version and refresh metadata are included for both metrics.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK199] Implement On Target Rate calculation using threshold-governance inputs
- [ ] [BQM-TK200] Implement Average Engagement aggregation logic per application and scope
- [ ] [BQM-TK201] Persist KPI metadata fields (definition version, refresh timestamp, source batch id)

### :link: Links

- **Epic:** EPIC-BQM-007 (`Documentation/Backlog/epics/epic-007-metrics-calculation-dashboard.md`)
- **Architecture:** `Documentation/ProjectSpecifications/architecture.md` - Sections 4.1.2, 5.3
- **PRD:** `Documentation/StakeholderDocuments/ApplicationGoals.md`
- **Sprint:** (Assign via Milestone)

### Business Rules

- Threshold default for on-target evaluation is 70 percent unless policy version override is approved.
- KPI outputs must include governance metadata for auditability.

### Data Impact & Pipelines

- **Reads:** `app.MatchedRecords`, `app.MetricSnapshots`, threshold policy metadata.
- **Writes:** Expanded KPI fields and metadata in governed metric snapshot outputs.
