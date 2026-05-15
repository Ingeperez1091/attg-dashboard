# BQM-US013 — View Numerator Filter Rules per Application

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-004 (Numerator Filter Configuration)  
> **Priority**: 2 — High | **Phase**: MVP

---

### :bust_in_silhouette: User Story

**As an** application owner  
**I want to** view the current numerator filter rules configured for my assigned applications, with filter fields dynamically sourced from the application model metadata  
**So that** I can understand which criteria are being applied to numerator data before metrics are calculated.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** I am an application_owner with assigned applications, **When** I navigate to the Filter Configuration tab, **Then** I see numerator filter rules only for my assigned applications.
- **Given** I am a viewer, **When** I view the filter rules, **Then** the rules are displayed in read-only mode.
- **Given** I am an administrator, **When** I navigate to the Filter Configuration tab, **Then** I see numerator filter rules for all applications.
- **Given** filter rules exist for an application, **When** displayed, **Then** each rule shows the field name (from `ApplicationModels`), operator, and value.
- **Given** `GET /api/filters/numerator/:appId` is called, **When** authorized, **Then** it returns the current rule set as JSON, including the `ApplicationModelId` and resolved `FieldName` for each rule.
- **Given** `GET /api/applications/:appId/model` is called, **When** authorized, **Then** it returns the application model fields, including `IsFiltirable` and `FieldType` for each field.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK050] Implement `GET /api/filters/numerator/:appId` endpoint (returns rules with resolved model field names)
- [ ] [BQM-TK050a] Implement `GET /api/applications/:appId/model` endpoint (returns application model field definitions)
- [ ] [BQM-TK051] Build filter rules display component (Motif WC) — field names populated from `ApplicationModels`
- [ ] [BQM-TK052] Apply role-based scoping (assigned apps only)
- [ ] [BQM-TK053] Write API contract and component tests (include model endpoint)

### :link: Links

- **Epic:** EPIC-BQM-004 (`Documentation/Backlog/epics/epic-004-numerator-filter-config.md`)
- **Architecture:** `Documentation/ProjectSpecifications/architecture.md` — Section 4.2
- **Sprint:** (Assign via Milestone)

### Business Rules

- Application owners and viewers see only their assigned applications' rules. Administrators see all.
- Filter field names displayed are resolved from `ApplicationModels` — not raw `ApplicationModelId` values.
- Only fields where `IsFiltirable = 1` in the application model are shown as filterable.

### Data Impact & Pipelines

- Read-only from `app.NumeratorFilterRules` joined with `app.ApplicationModels`. No writes.
