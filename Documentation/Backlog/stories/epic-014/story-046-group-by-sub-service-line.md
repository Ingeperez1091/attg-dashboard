# BQM-US046 — Group Applications by Sub Service Line in Dashboard

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-014 (Dashboard UI and Sub Service Line Grouping)  
> **Priority**: 1 — Critical | **Phase**: Extended-MVP B  
> **Changelog**: v1.0.0 — New story for grouped dashboard rendering.

---

### :bust_in_silhouette: User Story

**As a** reporting consumer  
**I want to** see applications grouped by Sub Service Line in the dashboard  
**So that** I can analyze performance from portfolio to grouped domain and then application detail.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** metric data is loaded, **When** the dashboard renders, **Then** applications are grouped under their `SubServiceLine` headings.
- **Given** group-level data, **When** I inspect a Sub Service Line, **Then** I see rollup KPI values and member application rows.
- **Given** I select a specific Sub Service Line filter, **When** data refreshes, **Then** only that group and its applications are shown.
- **Given** no applications exist in a selected group, **When** rendered, **Then** a clear empty-group state is shown without UI breakage.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK101] Implement grouping logic by `SubServiceLine` for dashboard dataset shaping
- [ ] [BQM-TK102] Implement group rollup rendering and per-application child rows
- [ ] [BQM-TK103] Add filter behavior and empty-group state coverage tests

### :link: Links

- **Epic:** EPIC-BQM-014 (`Documentation/Backlog/epics/epic-014-dashboard-ui-grouping.md`)
- **Architecture:** `Documentation/ProjectSpecifications/architecture.md` — Sections 4.1.1, 4.1.3
- **PRD:** `Documentation/StakeholderDocuments/ApplicationGoals.md`
- **Sprint:** (Assign via Milestone)

### Non-Functional Requirements

- Grouping and filter interactions must keep dashboard render under the defined performance target.
- Grouped rendering must preserve role/application scope constraints.

### Business Rules

- Group hierarchy is portfolio -> Sub Service Line -> application.
- Scoped users only see assigned applications within each group.

### Data Impact & Pipelines

- **Reads:** grouped application metadata and metric snapshots.
- **Writes:** None — presentation and query shaping only.