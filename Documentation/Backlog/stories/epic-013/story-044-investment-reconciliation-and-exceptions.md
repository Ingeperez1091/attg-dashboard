# BQM-US044 - Implement Investment Reconciliation and Exception Reporting

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-013 (Investment Data Onboarding and Reconciliation)  
> **Priority**: 2 - High | **Phase**: Extended-MVP C  
> **Changelog**: v2.0.0 - Reformatted to repository user story standard.

---

### :bust_in_silhouette: User Story

**As a** reporting consumer  
**I want to** review reconciliation and exception outputs for investment data  
**So that** KPI results are trusted and data issues are actionable.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** source and reporting investment totals, **When** reconciliation runs, **Then** totals are compared by period and scope with clear variance output.
- **Given** reconciliation exceptions, **When** exception handling executes, **Then** each exception is stored with reason category and run identifier.
- **Given** downstream KPI publication, **When** investment data is selected, **Then** only reconciled and approved records are eligible for consumption.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK196] Implement reconciliation logic and period/scope comparison outputs.
- [ ] [BQM-TK197] Implement exception classification and traceable output records.
- [ ] [BQM-TK198] Enforce downstream consumption of approved reconciled records only.

### :link: Links

- **Epic:** EPIC-BQM-013 (`Documentation/Backlog/epics/epic-013-investment-data-onboarding-reconciliation.md`)
- **Architecture:** `Documentation/ProjectSpecifications/architecture.md` - Sections 5.3, 10
- **Assumptions:** `Documentation/ProjectSpecifications/assumptions.md` - A28
- **Sprint:** (Assign via Milestone)

### Business Rules

- Reconciliation must be traceable per pipeline run identifier.
- Unreconciled data cannot be exposed to KPI consumers.

### Data Impact & Pipelines

- **Reads:** Normalized investment staging outputs and source control totals.
- **Writes:** Reconciliation summaries, exception records, and approved publishable investment datasets.


