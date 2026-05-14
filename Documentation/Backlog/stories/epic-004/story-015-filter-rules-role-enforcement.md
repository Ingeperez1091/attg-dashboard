# BQM-US015 — Filter Rules Respect Role and Application Assignment

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-004 (Numerator Filter Configuration)  
> **Priority**: 2 — High | **Phase**: MVP

---

### :bust_in_silhouette: User Story

**As a** system  
**I want to** enforce that filter rule editing is restricted by role and application assignment  
**So that** only authorized users can modify filter rules for their designated applications.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** an `application_owner` assigned to Maestro only, **When** they attempt to edit Prodigy's filter rules, **Then** the request is denied with 403.
- **Given** a `viewer`, **When** they attempt to `PUT` filter rules, **Then** the request is denied with 403.
- **Given** an `administrator`, **When** they edit filter rules for any application, **Then** the request succeeds.
- **Given** the Filter Configuration tab, **When** rendered for a non-admin user, **Then** only assigned applications appear in the application selector.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK058] Add authorization middleware to filter endpoints (check role + app assignment)
- [ ] [BQM-TK059] Scope application dropdown to user assignment
- [ ] [BQM-TK060] Write authorization tests for each role×application combination

### :link: Links

- **Epic:** EPIC-BQM-004 (`Documentation/Backlog/epics/epic-004-numerator-filter-config.md`)
- **Constitution:** Principle II — owners edit assigned apps, viewers read-only
- **Sprint:** (Assign via Milestone)

### Business Rules

- Owners: edit for assigned apps; Viewers: read-only; Administrators: edit all.

### Data Impact & Pipelines

- No direct data changes; authorization enforcement story.
