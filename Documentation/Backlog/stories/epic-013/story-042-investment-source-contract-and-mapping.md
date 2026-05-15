# BQM-US042 - Approve Investment Source Contract and Mapping

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-013 (Investment Data Onboarding and Reconciliation)  
> **Priority**: 1 - Critical | **Phase**: Extended-MVP C  
> **Changelog**: v2.0.0 - Reformatted to repository user story standard.

---

### :bust_in_silhouette: User Story

**As a** data engineer  
**I want to** approve the investment source contract and mapping  
**So that** investment metrics can be governed and reproducible.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** candidate investment source systems, **When** governance review is completed, **Then** one authoritative source is approved with ownership defined.
- **Given** approved source fields, **When** mapping design is documented, **Then** source-to-target mapping and grain policy are signed off.
- **Given** reporting normalization needs, **When** contract approval finalizes, **Then** currency and fiscal period normalization rules are approved.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK190] Facilitate governance review and source selection decision.
- [ ] [BQM-TK191] Produce source-to-target mapping artifact and approval record.
- [ ] [BQM-TK192] Document ownership, cadence, and normalization policies.

### :link: Links

- **Epic:** EPIC-BQM-013 (`Documentation/Backlog/epics/epic-013-investment-data-onboarding-reconciliation.md`)
- **Architecture:** `Documentation/ProjectSpecifications/architecture.md` - Sections 3, 4.4
- **Assumptions:** `Documentation/ProjectSpecifications/assumptions.md` - A26, A27
- **Sprint:** (Assign via Milestone)

### Business Rules

- One authoritative investment source is required before ingestion implementation.
- Contract approval must define ownership, cadence, and data grain.

### Data Impact & Pipelines

- **Reads:** Candidate source contracts and governance decisions.
- **Writes:** Approved source mapping specification used by downstream ETL ingestion.


