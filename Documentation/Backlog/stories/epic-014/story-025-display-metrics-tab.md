# BQM-US025 — Display Metrics in Application Usage Tab

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-014 (Dashboard UI and Sub Service Line Grouping)  
> **Priority**: 2 — High | **Phase**: Extended-MVP B  
> **Changelog**: v2.0.0 — Story reparented to EPIC-BQM-014 after epic split.

---

### :bust_in_silhouette: User Story

**As a** data consumer  
**I want to** view KPI metrics in the Application Usage dashboard  
**So that** I can assess adoption and revenue outcomes quickly.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** metric snapshots are available, **When** the dashboard loads, **Then** KPI values are rendered from the latest snapshot for authorized applications.
- **Given** a rendered application row, **When** inspected, **Then** key fields include counts, adoption percentage, revenue percentage, and run timestamp metadata.
- **Given** an application selection, **When** details are expanded, **Then** the view shows adoption level context and associated metric basis information.
- **Given** a pipeline recalculation is running, **When** the page is viewed, **Then** the latest completed snapshot remains visible with an in-progress indicator.
- **Given** no data exists for scope, **When** rendered, **Then** the no-data state appears without layout breakage.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK095] Implement Application Usage KPI card rendering from latest snapshot per authorized application
- [ ] [BQM-TK096] Implement detail panel rendering for counts, percentages, and run metadata
- [ ] [BQM-TK097] Add UI-state handling for no-data, in-progress, and error conditions

### :link: Links

- **Epic:** EPIC-BQM-014 (`Documentation/Backlog/epics/epic-014-dashboard-ui-grouping.md`)
- **Architecture:** `Documentation/ProjectSpecifications/architecture.md` — Sections 4.1, 4.1.1, 4.1.4
- **Assumptions:** `Documentation/ProjectSpecifications/assumptions.md`
- **Sprint:** (Assign via Milestone)

### Non-Functional Requirements

- Dashboard render performance must satisfy the defined page-load target.

### Business Rules

- Dashboard shows latest snapshot values per authorized application scope.
- Detail context includes adoption-level and revenue-basis metadata.

### Data Impact & Pipelines

- **Reads:** `app.MetricSnapshots`, `app.PipelineRuns`, `app.Applications`.
- **Writes:** None — display only.
