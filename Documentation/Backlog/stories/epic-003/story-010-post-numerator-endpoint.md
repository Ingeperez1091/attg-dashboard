# BQM-US010 — POST Endpoint for Numerator JSON Payload

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-003 (Numerator Data Ingestion API)  
> **Priority**: 1 — Critical | **Phase**: MVP

---

### :bust_in_silhouette: User Story

**As an** application developer  
**I want to** send numerator data as JSON to an API endpoint  
**So that** application usage data is received and staged for processing without requiring file uploads.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** a valid JSON payload with ApplicationId and data array, **When** I `POST /api/numerator`, **Then** the endpoint returns 201 with a confirmation containing the StageId.
- **Given** an invalid JSON structure, **When** I `POST /api/numerator`, **Then** the endpoint returns 400 with a descriptive error message.
- **Given** a missing or invalid ApplicationId, **When** I `POST /api/numerator`, **Then** the endpoint returns 400 with "Invalid ApplicationId" error.
- **Given** an unauthenticated request, **When** I `POST /api/numerator`, **Then** the endpoint returns 401.
- **Given** input contains potentially malicious content, **When** submitted, **Then** it is sanitized against injection attacks before storage.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK040] Implement `POST /api/numerator` route handler
- [ ] [BQM-TK041] Add JSON schema validation for payload
- [ ] [BQM-TK042] Add input sanitization
- [ ] [BQM-TK043] Write API contract tests (201, 400, 401 scenarios)

### :link: Links

- **Epic:** EPIC-BQM-003 (`Documentation/Backlog/epics/epic-003-numerator-ingestion-api.md`)
- **Architecture:** `Documentation/ProjectSpecifications/architecture.md` — Section 4.2 (POST /api/numerator)
- **PRD:** `StakeholderDocuments/AUTOMATED_SOLUTION_ARCHITECTURE.md` — API Ingest Approach
- **Sprint:** (Assign via Milestone)

### Business Rules

- Endpoint stores payload as-is in staging; processing is async.
- Input sanitized against injection attacks (Constitution Principle V).

### Data Impact & Pipelines

- Writes to `stage.EngagementUsageRaw`. Triggers downstream processing pipeline (EPIC-BQM-006).
