# BQM-US006 — Admin Creates and Deactivates Users

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-002 (User Administration & RBAC)  
> **Priority**: 1 — Critical | **Phase**: MVP

---

### :bust_in_silhouette: User Story

**As an** administrator  
**I want to** create new users and deactivate existing users  
**So that** I can onboard team members and revoke access when they leave without permanently deleting their records.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** I am an administrator, **When** I create a user providing identity key, email, display name, and active state, **Then** the user is created in `dbo.Users` with audit columns populated.
- **Given** a user exists, **When** I deactivate them, **Then** their IsActive flag is set to false (soft-delete) — the record is not physically removed.
- **Given** I am not an administrator, **When** I attempt to create or deactivate a user, **Then** the operation is denied with 403.
- **Given** I provide incomplete required fields, **When** I submit, **Then** a validation error is returned with clear messages.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK021] Implement `POST /api/users` endpoint (create user)
- [ ] [BQM-TK022] Implement `PUT /api/users/:userId` endpoint (update/deactivate)
- [ ] [BQM-TK023] Add admin-only authorization check
- [ ] [BQM-TK024] Write API contract tests for user CRUD

### :link: Links

- **Epic:** EPIC-BQM-002 (`Documentation/Backlog/epics/epic-002-user-administration.md`)
- **PRD:** `StakeholderDocuments/ApplicationFeatures.md` — Users Administration Tab
- **Constitution:** Principle V — "Administrators can create users... soft-delete users only"
- **Sprint:** (Assign via Milestone)

### Business Rules

- No additional user profile properties required beyond core identity fields for MVP.
- Soft-delete only — no hard delete. All mutations populate audit columns.

### Data Impact & Pipelines

- Writes to `dbo.Users`. Downstream: role assignment (US007), application assignment (US008).
