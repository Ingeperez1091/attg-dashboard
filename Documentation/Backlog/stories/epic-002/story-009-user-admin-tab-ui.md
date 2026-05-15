# BQM-US009 — User Administration Tab UI

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-002 (User Administration & RBAC)  
> **Priority**: 2 — High | **Phase**: MVP

---

### :bust_in_silhouette: User Story

**As an** administrator  
**I want to** access a User Administration tab in the dashboard  
**So that** I can manage users, roles, and application assignments through a visual interface.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** I am logged in as an administrator, **When** I navigate to the dashboard, **Then** the User Administration tab is visible and accessible.
- **Given** I am logged in as `application_owner` or `viewer`, **When** I navigate, **Then** the User Administration tab is not visible.
- **Given** I am a non-admin user, **When** I navigate directly to the admin route URL, **Then** I am blocked/redirected.
- **Given** I access the tab, **When** it loads, **Then** I see a list of users with their roles, active status, and assigned applications.
- **Given** I interact with the tab, **When** I create/edit/deactivate a user, **Then** the changes are reflected immediately in the list.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK033] Build User Administration tab component (Motif WC)
- [ ] [BQM-TK034] Implement admin-only route guard
- [ ] [BQM-TK035] Build user list view with role/status/app columns
- [ ] [BQM-TK036] Build create user form
- [ ] [BQM-TK037] Build edit user / deactivate user controls
- [ ] [BQM-TK038] Build application assignment interface with "All Applications" shortcut
- [ ] [BQM-TK039] Write component tests

### :link: Links

- **Epic:** EPIC-BQM-002 (`Documentation/Backlog/epics/epic-002-user-administration.md`)
- **PRD:** `StakeholderDocuments/ApplicationFeatures.md` — Users Administration Tab (full section)
- **Architecture:** `Documentation/ProjectSpecifications/architecture.md` — Section 4.1 (Tab Access Matrix)
- **Sprint:** (Assign via Milestone)

### Non-Functional Requirements

- Motif Web Components for UI foundation.
- Tab content must not be server-rendered for non-admin users.

### Business Rules

- Tab and route visible/accessible only to `administrator` users.

### Data Impact & Pipelines

- Read/write to Users, Roles, UserApplications via API endpoints.

### Prerequisites

- Baseline CI pipeline is already merged into protected trunk branches and enforced for PR validation.
