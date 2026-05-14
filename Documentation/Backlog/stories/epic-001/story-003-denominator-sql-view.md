# BQM-US003 — Denominator SQL View

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-001 (Database Foundation & Seed Data)  
> **Priority**: 1 — Critical | **Phase**: MVP

---

### :bust_in_silhouette: User Story

**As a** data engineer  
**I want to** validate connectivity to the externally managed Mercury denominator view with standardized columns  
**So that** the processing pipeline can query the addressable population using consistent column names and data types.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** Mercury access is configured, **When** I query `vw_USTaxBTS_FY26_MaxACD`, **Then** required columns are readable.
- **Given** setup automation is run with Mercury credentials, **When** external validation executes, **Then** pass/fail output is actionable.
- **Given** the view is queried, **When** results are returned, **Then** they represent Mercury-managed source-of-truth data.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK014] Implement external connectivity validation SQL for `vw_USTaxBTS_FY26_MaxACD`
- [ ] [BQM-TK015] Write tests validating required view column readability
- [ ] [BQM-TK016] Wire external validation execution into setup and runbook workflow

### :link: Links

- **Epic:** EPIC-BQM-001 (`Documentation/Backlog/epics/epic-001-database-foundation.md`)
- **Architecture:** `Documentation/ProjectSpecifications/architecture.md` — Section 4.3 (Denominator SQL View)
- **PRD:** `StakeholderDocuments/BUSINESS_RULES_AND_ETL_SUMMARY.md` — Required Columns, Data Type Coercion Rules
- **Sprint:** (Assign via Milestone)

### Business Rules

- Column data types must follow the coercion rules documented in the PRD.
- The view reflects the most recent weekly data load from Mercury.

### Data Impact & Pipelines

- Creates the denominator query surface used by the processing pipeline (EPIC-BQM-006) and denominator filter configuration (EPIC-BQM-008).


<!--
GitHub-Issue-Number: 
GitHub-Issue-URL: 
-->

<!--
AzureDevOps-WorkItem-Id: 0
AzureDevOps-WorkItem-Url: https://dev.azure.com/eygs3/attg-analytics-dashboard/_workitems/edit/0
-->
