# BQM-US045 — Generate Interim Investment Dummy Data in SQL

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-007 (Metrics Calculation and Interim Investment Dummy Data)  
> **Priority**: 1 — Critical | **Phase**: Extended-MVP A  
> **Changelog**: v1.0.0 — New story for interim synthetic investment dataset.

---

### :bust_in_silhouette: User Story

**As a** data engineer  
**I want to** generate and persist interim dummy investment data in the database  
**So that** KPI development and UI wiring can proceed before authoritative investment source onboarding is complete.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** EPIC-BQM-007 metric processing is available, **When** the seed process runs, **Then** synthetic investment records are inserted into SQL with `IsSynthetic = 1` and traceable metadata.
- **Given** dummy data exists, **When** metrics consumers query non-production datasets, **Then** synthetic investment values are available per application and calculation date.
- **Given** dummy dataset usage, **When** data is surfaced to API/UI consumers, **Then** values are explicitly labeled as non-authoritative synthetic data.
- **Given** reruns of the seed operation, **When** processed, **Then** inserts are deterministic and do not create duplicate rows for the same synthetic key.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK092] Create SQL table/contract for interim synthetic investment facts (non-authoritative)
- [ ] [BQM-TK093] Implement idempotent seed script to populate interim synthetic investment rows
- [ ] [BQM-TK094] Add tests validating deterministic inserts and synthetic-data labeling

### :link: Links

- **Epic:** EPIC-BQM-007 (`Documentation/Backlog/epics/epic-007-metrics-calculation-dashboard.md`)
- **Architecture:** `Documentation/ProjectSpecifications/architecture.md` — Section 4.3.1
- **Assumptions:** `Documentation/ProjectSpecifications/assumptions.md`
- **Sprint:** (Assign via Milestone)

### Business Rules

- Synthetic dataset is non-authoritative and non-production reporting only.
- Seed process must be idempotent and traceable.

### Data Impact & Pipelines

- **Writes:** Interim synthetic investment records in governed SQL structures.
- **Consumed by:** EPIC-BQM-014 dashboard development/testing and non-production KPI flows.