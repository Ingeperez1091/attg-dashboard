# BQM-US018 — Role-Based Data Visibility

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-005 (Authentication & Authorization)  
> **Priority**: 1 — Critical | **Phase**: Extended-MVP

---

### :bust_in_silhouette: User Story

**As an** application owner or viewer  
**I want to** see data only for applications assigned to me  
**So that** I am not exposed to data outside my scope and the system enforces least-privilege access.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** an `application_owner` assigned to Maestro and Navigate, **When** they view the Application Usage tab, **Then** they see metrics for Maestro and Navigate only.
- **Given** a `viewer` assigned to Prodigy, **When** they query `GET /api/metrics/:appId` for Maestro, **Then** they receive 403.
- **Given** an `administrator`, **When** they view any tab, **Then** they see data for all 5 applications.
- **Given** data scoping is applied, **When** API responses are inspected, **Then** no data from unassigned applications is included.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK068] Implement data scoping filter on all GET endpoints (metrics, filters, apps)
- [ ] [BQM-TK069] Scope dashboard tab data to user's assigned applications
- [ ] [BQM-TK070] Write tests for data scoping across roles

### :link: Links

- **Epic:** EPIC-BQM-005 (`Documentation/Backlog/epics/epic-005-authentication-authorization.md`)
- **PRD:** `StakeholderDocuments/ApplicationFeatures.md` — "Owners/viewers only view assigned applications"
- **Constitution:** Principle V
- **Sprint:** (Assign via Milestone)

### Business Rules

- Data scoping by UserApplications join. Admin bypasses scoping.

### Data Impact & Pipelines

- Read-only enforcement; filtered queries on all data retrieval endpoints.
