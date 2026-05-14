# BQM-US005 — Seed Super-Admin User

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-002 (User Administration & RBAC)  
> **Priority**: 1 — Critical | **Phase**: MVP

---

### :bust_in_silhouette: User Story

**As an** administrator  
**I want to** have a super-admin user seeded on initial deployment  
**So that** there is a bootstrapped admin account that can create other users and configure the system from day one.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** seed scripts have run, **When** I query `dbo.Users`, **Then** a super-admin user exists with role = `administrator` and IsActive = true.
- **Given** the super-admin exists, **When** I query `dbo.UserApplications`, **Then** the super-admin has access to all 5 applications.
- **Given** the super-admin logs in, **When** they navigate the dashboard, **Then** all tabs are accessible.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK018] Write seed script for super-admin user
- [ ] [BQM-TK019] Write seed script for super-admin application assignments (all apps)
- [ ] [BQM-TK020] Write test validating super-admin seed

### :link: Links

- **Epic:** EPIC-BQM-002 (`Documentation/Backlog/epics/epic-002-user-administration.md`)
- **PRD:** `StakeholderDocuments/ApplicationFeatures.md` — "Create a super admin who can access all features"
- **Constitution:** Principle V — "A super-admin user MUST be seeded on initial deployment"
- **Sprint:** (Assign via Milestone)

### Business Rules

- Exactly one super-admin user seeded; idempotent script.
- Super-admin has `administrator` role and access to all applications.

### Data Impact & Pipelines

- Populates `dbo.Users` and `dbo.UserApplications`. Required for first login and subsequent user management.
