# BQM-US032 — Maintain Manual Upload as Fallback/Override

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-009 (External API Integration)  
> **Priority**: 2 — High | **Phase**: Phase 3

---

### :bust_in_silhouette: User Story

**As an** application owner  
**I want to** continue using the manual JSON upload endpoint even after API integration is enabled  
**So that** I have a fallback when APIs are unavailable and can override API-fetched data when needed.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** Maestro API integration is active, **When** I manually upload Maestro numerator data via `POST /api/numerator`, **Then** the upload succeeds and the data is staged normally.
- **Given** both API-fetched and manually uploaded data exist for the same application, **When** the pipeline processes them, **Then** the most recent upload takes precedence (by CreateDate).
- **Given** an API connector fails, **When** I upload manually, **Then** the processing pipeline uses the manual upload data.
- **Given** the upload endpoint, **When** called, **Then** no behavioral changes have been introduced by the API integration feature.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK117] Verify existing POST /api/numerator endpoint remains unchanged
- [ ] [BQM-TK118] Implement "most recent upload wins" logic in processing pipeline
- [ ] [BQM-TK119] Write regression tests ensuring manual upload works alongside API

### :link: Links

- **Epic:** EPIC-BQM-009 (`Documentation/Backlog/epics/epic-009-external-api-integration.md`)
- **PRD:** `StakeholderDocuments/ApplicationGoals.md` — Phase 3: "Maintain spreadsheet upload as fallback/override"
- **Constitution:** Principle VI — "Later phases MUST NOT break functionality delivered in earlier phases"
- **Sprint:** (Assign via Milestone)

### Business Rules

- Manual upload path is never disabled. Most recent upload (by timestamp) takes precedence.

### Data Impact & Pipelines

- No schema changes. Pipeline precedence logic added for `stage.EngagementUsageRaw` records.
