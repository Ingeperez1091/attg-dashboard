# BQM-US026 — Role/Application-Scoped Metric Visibility

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-014 (Dashboard UI and Sub Service Line Grouping)  
> **Priority**: 2 — High | **Phase**: Extended-MVP B  
> **Changelog**: v2.0.0 — Story reparented to EPIC-BQM-014 after epic split.

---

### :bust_in_silhouette: User Story

**As a** system  
**I want to** scope dashboard metrics by role and application assignment  
**So that** users only see data they are authorized to access.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** an administrator session, **When** dashboard metrics are requested, **Then** all in-scope applications are returned.
- **Given** a non-administrator session, **When** dashboard metrics are requested, **Then** only assigned applications are returned.
- **Given** a request for an unassigned application, **When** access checks run, **Then** access is denied.
- **Given** grouped dashboard output, **When** rendered, **Then** unauthorized applications are excluded from cards, groups, and detail rows.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK098] Enforce server-side application scoping in dashboard metric APIs
- [ ] [BQM-TK099] Ensure grouped rendering excludes unauthorized applications across cards and detail panels
- [ ] [BQM-TK100] Add role-scope test coverage for admin, owner, and viewer scenarios

### :link: Links

- **Epic:** EPIC-BQM-014 (`Documentation/Backlog/epics/epic-014-dashboard-ui-grouping.md`)
- **Architecture:** `Documentation/ProjectSpecifications/architecture.md` — Sections 4.1, 4.1.4
- **PRD:** `Documentation/StakeholderDocuments/ApplicationFeatures.md`
- **Sprint:** (Assign via Milestone)

### Business Rules

- Server-side authorization is authoritative; frontend filtering is presentation-only.
- Scoped visibility applies consistently to KPI cards, grouped sections, and detail rows.

### Data Impact & Pipelines

- **Reads:** `app.MetricSnapshots`, `app.UserApplications`, `app.Users`, `app.Roles`.
- **Writes:** None — read-only scoped queries.
