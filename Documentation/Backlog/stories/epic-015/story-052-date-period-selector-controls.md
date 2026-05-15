# BQM-US052 - Implement Date and Period Selector Controls

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-015 (Advanced Dashboard Time Controls and Trend Insights)  
> **Priority**: 2 - High | **Phase**: Phase 3  
> **Changelog**: v1.0.0 - New story for deferred date/period dashboard controls.

---

### :bust_in_silhouette: User Story

**As a** reporting consumer  
**I want to** filter dashboard insights by date and period basis  
**So that** I can evaluate KPI performance in the time context relevant to decision cycles.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** dashboard access, **When** period controls are displayed, **Then** users can select approved date windows and ETD/FYTD basis options.
- **Given** a selected date/period filter, **When** KPI data refreshes, **Then** cards and grouped detail rows reflect the selected temporal scope.
- **Given** role-scoped access, **When** date controls are used, **Then** returned data remains restricted to authorized application scope.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK214] Implement date and period selector control components with governed defaults
- [ ] [BQM-TK215] Add API/query support for date-window and basis parameters
- [ ] [BQM-TK216] Add integration tests for scoped temporal filtering behavior

### :link: Links

- **Epic:** EPIC-BQM-015 (`Documentation/Backlog/epics/epic-015-advanced-dashboard-time-controls.md`)
- **Architecture:** `Documentation/ProjectSpecifications/architecture.md` - Sections 4.1.3, 10
- **Sprint:** (Assign via Milestone)

### Business Rules

- Date controls must honor metric-definition version validity windows.
- Temporal filtering cannot bypass application-level authorization scope.

### Data Impact & Pipelines

- **Reads:** `app.MetricSnapshots`, period metadata, and role/application assignments.
- **Writes:** None - query shaping and presentation only.
