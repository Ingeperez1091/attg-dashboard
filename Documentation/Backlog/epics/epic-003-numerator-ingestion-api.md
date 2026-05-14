# EPIC-BQM-003 — Numerator Data Ingestion API

> **Azure DevOps Work Item Type**: Epic  
> **ADO ID**: _TBD — to be assigned upon creation in Azure DevOps_  
> **ADO Link**: _TBD_  
> **Phase**: MVP

---

## :dart: Objective

Expose a JSON API endpoint that receives numerator data for each application and stores it in the staging table for asynchronous processing.

## :memo: Description (ADO)

Implement the `POST /api/numerator` endpoint that accepts JSON payloads containing application numerator data. The endpoint must store the payload as-is in the `stage.EngagementUsageRaw` table (StageId, ApplicationId, PayloadJson) and return a success acknowledgment. Processing (validation, filtering, metric calculation) occurs asynchronously downstream. Basic error handling must return meaningful messages on failure.

## :chart_with_upwards_trend: Business Value

Provides the primary data entry point for numerator data across all 5 applications. Without this API, no adoption metrics can be calculated. The async design ensures the upload experience is fast and non-blocking.

## :white_check_mark: Acceptance Criteria

- [ ] `POST /api/numerator` accepts valid JSON payload with ApplicationId and data.
- [ ] Payload stored in `stage.EngagementUsageRaw` with upload metadata (user, timestamp).
- [ ] Invalid payloads return clear error responses (400) without processing.
- [ ] Endpoint validates authorization before processing (401/403 on failure).
- [ ] Input sanitized against injection attacks.
- [ ] Basic error handling returns "Failed to load data" style messages on server errors.
- [ ] Numerator ingestion pull requests pass the baseline CI quality gates (lint, type-check, automated tests).

## :link: Dependencies

- EPIC-BQM-001 (Database Foundation — `stage.EngagementUsageRaw` table)
- EPIC-BQM-010 (CI Pipeline — baseline CI merged to protected trunk branches before epic source-code tasks begin).

## :classical_building: Architecture & Design Notes

- `Documentation/ProjectSpecifications/architecture.md` — Section 4.2 (API Layer, POST /api/numerator), Section 5.2 (Numerator Flow)

## :clipboard: Scope

**In Scope:** POST endpoint for numerator JSON ingestion; Staging table write; Upload metadata persistence; Input validation and sanitization.

**Out of Scope:** Async processing pipeline (EPIC-BQM-006); Metric calculation (EPIC-BQM-007); Maestro/Prodigy automated API feeds (EPIC-BQM-009).

## :book: Linked User Stories

- [ ] [BQM-US010] POST endpoint for numerator JSON payload
- [ ] [BQM-US011] Store payload in staging table
- [ ] [BQM-US012] Basic error handling for ingestion

## :white_check_mark: Definition of Done (DoD)

- [ ] All linked User Stories are closed.
- [ ] Integration testing completed.

## :page_facing_up: PRD References

- `StakeholderDocuments/ApplicationGoals.md` — Phase 1: "Create an API to receive the numerator data"
- `StakeholderDocuments/AUTOMATED_SOLUTION_ARCHITECTURE.md` — API Ingest Approach
- `.specify/memory/constitution.md` — Principle III (Validated Data Ingestion)
