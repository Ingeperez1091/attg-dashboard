# BQM-US031 — Connect to Prodigy API for Automated Numerator Data

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-009 (External API Integration)  
> **Priority**: 2 — High | **Phase**: Phase 3

---

### :bust_in_silhouette: User Story

**As a** data engineer  
**I want to** automatically fetch Prodigy client engagement data via its API on a configurable schedule  
**So that** numerator data for Prodigy is always current without manual export/upload cycles.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** the Prodigy API connector is configured, **When** the scheduled fetch runs, **Then** client engagement data is fetched and stored in `stage.EngagementUsageRaw` with ApplicationId = Prodigy.
- **Given** the fetch completes, **When** the processing pipeline triggers, **Then** the data follows the standard validation → filter → calculate path.
- **Given** the Prodigy API is unavailable, **When** the fetch fails, **Then** the failure is logged and manual upload remains unaffected.
- **Given** a manual upload is submitted after an API fetch, **When** processed, **Then** the manual data can override the API-fetched data.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK113] Implement Prodigy API connector (authentication, data fetch)
- [ ] [BQM-TK114] Configure scheduled trigger (ADF or cron)
- [ ] [BQM-TK115] Map Prodigy API response to staging payload format
- [ ] [BQM-TK116] Write integration tests with mock API

### :link: Links

- **Epic:** EPIC-BQM-009 (`Documentation/Backlog/epics/epic-009-external-api-integration.md`)
- **PRD:** `StakeholderDocuments/ApplicationGoals.md` — Phase 3: "Connect to Maestro and Prodigy APIs"
- **Sprint:** (Assign via Milestone)

### Business Rules

- Prodigy matches by Client ID (not Engagement ID). Same staging path as manual uploads.

### Data Impact & Pipelines

- Writes to `stage.EngagementUsageRaw`. Triggers downstream processing.
