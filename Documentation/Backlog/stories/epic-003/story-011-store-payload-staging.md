# BQM-US011 — Store Payload in Staging Table

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-003 (Numerator Data Ingestion API)  
> **Priority**: 1 — Critical | **Phase**: MVP

---

### :bust_in_silhouette: User Story

**As a** data engineer  
**I want to** have every numerator payload persisted with full upload metadata  
**So that** raw data is always available for audit and the processing pipeline has a reliable source to read from.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** the endpoint receives a valid payload, **When** it is stored, **Then** `stage.EngagementUsageRaw` contains: StageId (auto), ApplicationId, PayloadJson (raw JSON), CreateDate (now), CreatedBy (authenticated user).
- **Given** a stored record, **When** the processing pipeline reads it, **Then** the original PayloadJson is unmodified.
- **Given** multiple uploads for the same application, **When** queried, **Then** each upload has a distinct StageId and CreateDate for auditability.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK044] Implement database write logic in endpoint handler
- [ ] [BQM-TK045] Populate CreateDate and CreatedBy from request context
- [ ] [BQM-TK046] Write integration test verifying staging record fidelity

### :link: Links

- **Epic:** EPIC-BQM-003 (`Documentation/Backlog/epics/epic-003-numerator-ingestion-api.md`)
- **Constitution:** Principle III — staging before any processing
- **Sprint:** (Assign via Milestone)

### Business Rules

- Raw data preserved before any transformation (Constitution Principle I).
- Upload metadata persisted for every ingestion event (Constitution Principle III).

### Data Impact & Pipelines

- Direct write to `stage.EngagementUsageRaw`. Immutable after write — processing pipeline reads only.
