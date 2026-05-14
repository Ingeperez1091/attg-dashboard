# BQM-US012 — Basic Error Handling for Ingestion

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-003 (Numerator Data Ingestion API)  
> **Priority**: 2 — High | **Phase**: MVP

---

### :bust_in_silhouette: User Story

**As an** application developer  
**I want to** receive clear error messages when data ingestion fails  
**So that** I can diagnose and correct issues with my numerator data submissions.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** a server error during save, **When** the endpoint responds, **Then** it returns 500 with a "Failed to load data" message without leaking internal details.
- **Given** a malformed JSON body, **When** submitted, **Then** it returns 400 with "Invalid JSON format" message.
- **Given** ApplicationId does not exist in the Applications table, **When** submitted, **Then** it returns 400 with "Application not found" message.
- **Given** any error response, **When** inspected, **Then** it does not contain stack traces, SQL details, or internal paths.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK047] Implement error handling middleware for numerator route
- [ ] [BQM-TK048] Sanitize error responses to prevent information leakage
- [ ] [BQM-TK049] Write tests for each error scenario

### :link: Links

- **Epic:** EPIC-BQM-003 (`Documentation/Backlog/epics/epic-003-numerator-ingestion-api.md`)
- **PRD:** `StakeholderDocuments/ApplicationFeatures.md` — "Show 'Failed to load data' if something goes wrong"
- **Constitution:** Principle V — no internal detail leakage
- **Sprint:** (Assign via Milestone)

### Business Rules

- Error messages are user-friendly; no internal detail leakage.

### Data Impact & Pipelines

- No data written on error. Error context logged server-side for debugging.
