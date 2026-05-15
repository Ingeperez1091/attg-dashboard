# BQM-US002 — Seed Application Data

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-001 (Database Foundation & Seed Data)  
> **Priority**: 1 — Critical | **Phase**: MVP

---

### :bust_in_silhouette: User Story

**As a** data engineer  
**I want to** have the 5 in-scope applications pre-seeded in the database  
**So that** the system has valid application references for filter configuration, numerator ingestion, and user assignment from day one.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** seed scripts have run, **When** I query `app.Applications`, **Then** 5 rows exist: Maestro, EYST, Prodigy, Vector, Navigate.
- **Given** setup automation runs, **When** seeding completes, **Then** rerunning automation does not create duplicate application/role data.
- **Given** the Maestro row, **When** I inspect it, **Then** AdoptionLevel = "Engagement", MatchKey = "EngagementId".
- **Given** the EYST row, **When** I inspect it, **Then** AdoptionLevel = "Client", MatchKey = "ClientId".
- **Given** the Prodigy row, **When** I inspect it, **Then** AdoptionLevel = "Client", MatchKey = "ClientId".
- **Given** the Vector row, **When** I inspect it, **Then** AdoptionLevel = "Engagement", MatchKey = "EngagementId".
- **Given** the Navigate row, **When** I inspect it, **Then** AdoptionLevel = "Engagement", MatchKey = "EngagementId".

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK010] Write seed script for `app.Applications` (5 applications)
- [ ] [BQM-TK011] Write seed script for `app.Roles` (administrator, application_owner, viewer)
- [ ] [BQM-TK012] Write tests to verify seed data correctness
- [ ] [BQM-TK013] Ensure setup script executes seed phase and idempotency checks

### :link: Links

- **Epic:** EPIC-BQM-001 (`Documentation/Backlog/epics/epic-001-database-foundation.md`)
- **PRD:** `StakeholderDocuments/AUTOMATED_SOLUTION_ARCHITECTURE.md` — Applications in Scope table
- **Sprint:** (Assign via Milestone)

### Business Rules

- Application metadata must match the PRD exactly (adoption level, source, match key).
- Seed scripts are idempotent — re-running does not create duplicates.

### Data Impact & Pipelines

- Populates `app.Applications` and `app.Roles` tables. Required before any user assignment or filter configuration.


<!--
GitHub-Issue-Number: 
GitHub-Issue-URL: 
-->

<!--
AzureDevOps-WorkItem-Id: 0
AzureDevOps-WorkItem-Url: https://dev.azure.com/eygs3/attg-analytics-dashboard/_workitems/edit/0
-->
