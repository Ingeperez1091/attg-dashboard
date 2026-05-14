# BQM-US004 — Staging Table Setup

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-001 (Database Foundation & Seed Data)  
> **Priority**: 1 — Critical | **Phase**: MVP

---

### :bust_in_silhouette: User Story

**As a** data engineer  
**I want to** have the `stage.EngagementUsageRaw` staging table properly configured  
**So that** incoming numerator JSON payloads are stored with full metadata before any processing occurs.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** the staging table exists, **When** a record is inserted, **Then** StageId is auto-generated, ApplicationId references a valid application, PayloadJson stores the raw JSON, and CreateDate/CreatedBy are populated.
- **Given** a foreign key on ApplicationId, **When** an invalid ApplicationId is inserted, **Then** the insert fails with a clear constraint violation.
- **Given** raw data is stored, **When** processing occurs downstream, **Then** the original staging record is never modified — only read.
- **Given** setup automation runs, **When** deployment completes, **Then** staging schema scripts are represented in the generated SQL project snapshot output.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK016] Write DDL for `stage.EngagementUsageRaw` with FK to Applications
- [ ] [BQM-TK017] Write constraint tests
- [ ] [BQM-TK018] Validate SQL project snapshot includes staging schema assets

### :link: Links

- **Epic:** EPIC-BQM-001 (`Documentation/Backlog/epics/epic-001-database-foundation.md`)
- **Architecture:** `Documentation/ProjectSpecifications/architecture.md` — Section 4.3 (stage schema)
- **PRD:** `StakeholderDocuments/AUTOMATED_SOLUTION_ARCHITECTURE.md` — Data Storage Concept
- **Sprint:** (Assign via Milestone)

### Business Rules

- Raw data must be preserved in staging tables before any transformation (Constitution Principle I).
- Upload metadata (user, timestamp) persisted for every ingestion event (Constitution Principle III).

### Data Impact & Pipelines

- Entry point for all numerator data. Read by EPIC-BQM-006 (Validation Pipeline).


<!--
GitHub-Issue-Number: 
GitHub-Issue-URL: 
-->

<!--
AzureDevOps-WorkItem-Id: 0
AzureDevOps-WorkItem-Url: https://dev.azure.com/eygs3/attg-analytics-dashboard/_workitems/edit/0
-->
