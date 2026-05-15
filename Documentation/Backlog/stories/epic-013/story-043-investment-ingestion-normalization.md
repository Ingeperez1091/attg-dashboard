# BQM-US043 - Implement Investment Ingestion and Normalization

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-013 (Investment Data Onboarding and Reconciliation)  
> **Priority**: 1 - Critical | **Phase**: Extended-MVP C  
> **Changelog**: v2.0.0 - Reformatted to repository user story standard.

---

### :bust_in_silhouette: User Story

**As a** data engineer  
**I want to** ingest and normalize investment data in ETL  
**So that** downstream KPI calculations consume consistent financial inputs.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** approved investment source contract, **When** ETL ingestion runs, **Then** source records are loaded into governed pipeline structures.
- **Given** period and currency normalization rules, **When** transformation executes, **Then** values are normalized consistently across records.
- **Given** invalid source rows, **When** validation checks fail, **Then** reject records are stored with explicit reason codes.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK193] Implement investment ingestion flow in ETL orchestration.
- [ ] [BQM-TK194] Implement transformation logic for period/currency normalization.
- [ ] [BQM-TK195] Implement validation and reject-path logging.

### :link: Links

- **Epic:** EPIC-BQM-013 (`Documentation/Backlog/epics/epic-013-investment-data-onboarding-reconciliation.md`)
- **Architecture:** `Documentation/ProjectSpecifications/architecture.md` - Sections 4.3.1, 5
- **Assumptions:** `Documentation/ProjectSpecifications/assumptions.md` - A27, A28
- **Sprint:** (Assign via Milestone)

### Business Rules

- Ingestion implementation must follow approved source contract exactly.
- Normalization must be deterministic for equivalent input values.

### Data Impact & Pipelines

- **Reads:** Approved investment source feed and mapping specification.
- **Writes:** Normalized investment staging outputs and reject-path audit records.


