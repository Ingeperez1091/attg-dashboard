# BQM-US030 — Connect to Maestro API for Automated Numerator Data

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-009 (External API Integration)  
> **Priority**: 2 — High | **Phase**: Phase 3

---

### :bust_in_silhouette: User Story

**As a** data engineer  
**I want to** automatically fetch Maestro engagement data via its API on a configurable schedule  
**So that** numerator data for Maestro is always current without manual export/upload cycles.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** the Maestro API connector is configured, **When** the scheduled fetch runs, **Then** engagement utilization data is fetched and stored in `stage.EngagementUsageRaw` with ApplicationId = Maestro.
- **Given** the fetch completes, **When** the processing pipeline triggers, **Then** the data follows the standard validation → filter → calculate path.
- **Given** the Maestro API is unavailable, **When** the fetch fails, **Then** the failure is logged and the manual upload path remains unaffected.
- **Given** a manual upload is submitted after an API fetch, **When** processed, **Then** the manual data can override the API-fetched data.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK109] Implement Maestro API connector (authentication, data fetch)
- [ ] [BQM-TK110] Configure scheduled trigger (ADF or cron)
- [ ] [BQM-TK111] Map Maestro API response to staging payload format
- [ ] [BQM-TK112] Write integration tests with mock API

### :link: Links

- **Epic:** EPIC-BQM-009 (`Documentation/Backlog/epics/epic-009-external-api-integration.md`)
- **PRD:** `StakeholderDocuments/ApplicationGoals.md` — Phase 3: "Connect to Maestro and Prodigy APIs"
- **Sprint:** (Assign via Milestone)

### Business Rules

- Connector uses the same staging path as manual uploads. Failures are non-blocking.

### Data Impact & Pipelines

- Writes to `stage.EngagementUsageRaw`. Triggers downstream processing.
