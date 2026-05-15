# BQM-US016 — Seed Application Model Definitions for All Five Applications

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-004 (Numerator Filter Configuration)  
> **Priority**: 1 — Critical | **Phase**: MVP

---

### :bust_in_silhouette: User Story

**As a** data engineer  
**I want to** have the `ApplicationModels` table seeded with the field definitions for all five applications (Navigate, EYST, Prodigy, Maestro, Vector)  
**So that** the numerator filter configuration UI can dynamically discover which fields are available per application, and ADF can parse JSON payloads using the model metadata.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** the database is deployed, **When** the seed script runs, **Then** `ApplicationModels` contains the complete field definitions for Navigate (7 fields), EYST (7 fields), Prodigy (7 fields), Maestro (5 fields), and Vector (6 fields) as documented in `Documentation/ProjectSpecifications/architecture.md` — Per-Application Payload Templates.
- **Given** every seeded record, **When** inspected, **Then** `ApplicationId` references a valid `Applications` record for the corresponding app.
- **Given** the seeded Navigate model, **When** queried for filterable fields, **Then** exactly the fields marked `IsFiltirable = 1` are returned: `RevenueFYTD`, `NavigateStatus`.
- **Given** the seeded EYST model, **When** queried for filterable fields, **Then** exactly the fields marked `IsFiltirable = 1` are returned: `EngagementCount`, `TotalRevenueETD`, `EYSTActive`, `EYSTDataCleanupActive`.
- **Given** the seeded Maestro model, **When** queried for filterable fields, **Then** exactly the fields marked `IsFiltirable = 1` are returned: `ClientId`, `InMaestro`.
- **Given** the seeded Prodigy model, **When** queried for filterable fields, **Then** exactly the fields marked `IsFiltirable = 1` are returned: `EngagementCount`, `TotalRevenueFYTD`, `Override`.
- **Given** the seeded Vector model, **When** queried for filterable fields, **Then** exactly the fields marked `IsFiltirable = 1` are returned: `ClientId`, `RevenueFYTD`, `RevenueETD`, `VectorEngagement`.
- **Given** `GET /api/applications/:appId/model` is called for any application, **When** authorized, **Then** it returns the seeded model fields including `FieldName`, `FieldType`, `IsFiltirable`, `IsMetricDimension`, and `DisplayOrder`.
- **Given** the seed script is re-run, **When** executed, **Then** it is idempotent — existing records are not duplicated.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK061] Create `ApplicationModels` table migration (if not already in EPIC-BQM-001)
- [ ] [BQM-TK062] Write seed script for Navigate application model (7 fields)
- [ ] [BQM-TK063] Write seed script for EYST application model (7 fields)
- [ ] [BQM-TK064] Write seed script for Prodigy application model (7 fields)
- [ ] [BQM-TK065] Write seed script for Maestro application model (5 fields)
- [ ] [BQM-TK066] Write seed script for Vector application model (6 fields)
- [ ] [BQM-TK067] Write tests verifying seed data completeness and idempotency

### :link: Links

- **Epic:** EPIC-BQM-004 (`Documentation/Backlog/epics/epic-004-numerator-filter-config.md`)
- **Architecture:** `Documentation/ProjectSpecifications/architecture.md` — Section 4.3 (Application Model Metadata, Per-Application Payload Templates)
- **Assumptions:** `Documentation/ProjectSpecifications/assumptions.md` — A15 (Metadata-Driven Application Models), A17 (Per-Application Payload Templates Stable)
- **PRD:** `StakeholderDocuments/AUTOMATED_SOLUTION_ARCHITECTURE.md` — Payload Template sections; Metadata-based architecture
- **Sprint:** (Assign via Milestone)

### Business Rules

- Seed data must match the payload templates documented in the architecture specification exactly.
- `SourcePath` values use JSON path syntax (e.g., `$.navigateStatus`) for ADF dynamic parsing.
- `DisplayOrder` determines the field ordering in the filter configuration UI.
- This story must be completed before US013 and US014 can function, as those stories depend on model data being present.

### Data Impact & Pipelines

- Writes to `app.ApplicationModels`. Read by filter config API (US013/US014) and ADF processing pipeline (EPIC-BQM-006).
