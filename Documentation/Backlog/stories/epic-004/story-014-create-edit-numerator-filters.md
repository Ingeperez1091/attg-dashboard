# BQM-US014 — Create/Edit Numerator Filter Rules

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-004 (Numerator Filter Configuration)  
> **Priority**: 2 — High | **Phase**: MVP

---

### :bust_in_silhouette: User Story

**As an** application owner  
**I want to** create and edit numerator filter rules by selecting fields from the application model metadata  
**So that** I can control which numerator records qualify for adoption metrics using validated, model-defined fields.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** I am an application_owner for Navigate, **When** I add a rule, **Then** the field dropdown shows only fields from `ApplicationModels` where `IsFiltirable = 1` (e.g., `NavigateStatus`, `RevenueFYTD`).
- **Given** I select `NavigateStatus` and operator `=` and value `Navigate`, **When** I save, **Then** the rule is saved in `app.NumeratorFilterRules` with `ApplicationModelId` referencing the `NavigateStatus` model field, `Operator`=`=`, `Value`=`Navigate`.
- **Given** an existing rule, **When** I edit its value, **Then** the previous value is preserved in the audit log and the new value is effective.
- **Given** I am a viewer, **When** I attempt to edit a rule, **Then** the edit controls are disabled.
- **Given** `PUT /api/filters/numerator/:appId` is called with a valid rule set, **When** authorized, **Then** the rules are persisted with valid `ApplicationModelId` references.
- **Given** a rule references an `ApplicationModelId` that does not exist or is not `IsFiltirable`, **When** submitted, **Then** the API returns a 400 validation error.
- **Given** any rule change, **When** saved, **Then** an audit record is created with user, previous value(s), and timestamp.
- **Given** the selected field has `FieldType = string`, **When** displayed, **Then** the operator options include `=`, `!=`, `IN`, `NOT IN`, `CONTAINS`, `NOT CONTAINS`.
- **Given** the selected field has `FieldType = numeric`, **When** displayed, **Then** the operator options include `=`, `!=`, `>`, `>=`, `<`, `<=`.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK054] Implement `PUT /api/filters/numerator/:appId` endpoint (validates `ApplicationModelId` FK, `IsFiltirable` flag)
- [ ] [BQM-TK055] Build dynamic field-operator-value rule editor component — field dropdown populated from `GET /api/applications/:appId/model` (IsFiltirable fields only); operator options adapt to `FieldType`
- [ ] [BQM-TK056] Implement audit logging for rule changes
- [ ] [BQM-TK057] Write tests for CRUD operations, model validation, and audit trail

### :link: Links

- **Epic:** EPIC-BQM-004 (`Documentation/Backlog/epics/epic-004-numerator-filter-config.md`)
- **PRD:** `StakeholderDocuments/AUTOMATED_SOLUTION_ARCHITECTURE.md` — SET Numerator filter mockup
- **Constitution:** Principle II — "Numerator filter rules MUST support dynamic field-operator-value expressions"
- **Sprint:** (Assign via Milestone)

### Business Rules

- Supported operators vary by field type:
  - `string`: `=`, `!=`, `IN`, `NOT IN`, `CONTAINS`, `NOT CONTAINS`
  - `numeric`: `=`, `!=`, `>`, `>=`, `<`, `<=`
  - `boolean`: `=`
  - `date`: `>`, `>=`, `<`, `<=`, `=`
- Filter rules reference `ApplicationModelId` (FK) — not raw field name strings.
- Only model fields with `IsFiltirable = 1` may be selected.
- Rule changes audit-logged (Constitution Principle II).

### Data Impact & Pipelines

- Writes to `app.NumeratorFilterRules` (with FK to `app.ApplicationModels`). Consumed by processing pipeline (EPIC-BQM-006).
