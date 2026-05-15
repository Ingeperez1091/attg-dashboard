# BQM-US008 — Admin Assigns Applications to Users

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-002 (User Administration & RBAC)  
> **Priority**: 1 — Critical | **Phase**: MVP

---

### :bust_in_silhouette: User Story

**As an** administrator  
**I want to** assign users to one or many applications, including an "All Applications" shortcut  
**So that** users only see and interact with the applications within their authorized scope.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** I am an administrator, **When** I assign a user to one or more applications, **Then** corresponding rows are created in `dbo.UserApplications`.
- **Given** I use the "All Applications" shortcut, **When** I save, **Then** the user is linked to all 5 applications.
- **Given** a user is already linked to an application, **When** I try to assign the same application again, **Then** the duplicate is prevented (no error, no duplicate row).
- **Given** I remove an application assignment, **When** the user's next request is evaluated, **Then** they no longer see data for that application.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK028] Implement `POST /api/users/:userId/applications` (assign)
- [ ] [BQM-TK029] Implement `DELETE /api/users/:userId/applications/:appId` (unassign)
- [ ] [BQM-TK030] Implement "All Applications" shortcut logic
- [ ] [BQM-TK031] Add unique constraint on (UserId, ApplicationId)
- [ ] [BQM-TK032] Write tests for assignment, duplicate prevention, and removal

### :link: Links

- **Epic:** EPIC-BQM-002 (`Documentation/Backlog/epics/epic-002-user-administration.md`)
- **PRD:** `StakeholderDocuments/ApplicationFeatures.md` — "'All Applications' shortcut"
- **Constitution:** Principle V — "Duplicate per-user application links MUST be prevented"
- **Sprint:** (Assign via Milestone)

### Business Rules

- Unique constraint on (UserId, ApplicationId). "All Applications" creates individual rows.

### Data Impact & Pipelines

- Writes to `dbo.UserApplications`. Impacts role-based data scoping across all tabs.
