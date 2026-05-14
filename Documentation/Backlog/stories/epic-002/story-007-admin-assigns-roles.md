# BQM-US007 — Admin Assigns Roles to Users

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-002 (User Administration & RBAC)  
> **Priority**: 1 — Critical | **Phase**: MVP

---

### :bust_in_silhouette: User Story

**As an** administrator  
**I want to** assign exactly one role to each user  
**So that** the system enforces proper authorization boundaries based on the user's role.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** I am an administrator, **When** I assign a role to a user, **Then** the user's RoleId is updated to the selected role.
- **Given** a user already has a role, **When** I assign a different role, **Then** the previous role is replaced (exactly one role at a time).
- **Given** I attempt to assign a role not in {administrator, application_owner, viewer}, **When** I submit, **Then** a validation error is returned.
- **Given** a role change is saved, **When** the user's next request is evaluated, **Then** the new role is effective for authorization checks.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK025] Implement role assignment in `PUT /api/users/:userId`
- [ ] [BQM-TK026] Enforce single-role constraint
- [ ] [BQM-TK027] Write tests for role assignment and constraint validation

### :link: Links

- **Epic:** EPIC-BQM-002 (`Documentation/Backlog/epics/epic-002-user-administration.md`)
- **PRD:** `StakeholderDocuments/ApplicationFeatures.md` — "Exactly one role is allowed per user"
- **Constitution:** Principle V — roles constrained to {administrator, application_owner, viewer}
- **Sprint:** (Assign via Milestone)

### Business Rules

- Allowed roles: `administrator`, `application_owner`, `viewer`.
- Exactly one role per user — enforced at database and API level.

### Data Impact & Pipelines

- Updates `dbo.Users.RoleId`. Impacts all downstream authorization decisions.
