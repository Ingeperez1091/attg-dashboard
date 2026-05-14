# BQM-US027 — Denominator Rule Configuration UI

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-008 (Denominator Rules Configuration)  
> **Priority**: 2 — High | **Phase**: Phase 2  
> **Changelog**: v1.1.0 — Aligned with model-driven architecture; replaced hardcoded filter types with DenominatorModels-driven fields; updated table references from `dbo` to `app` schema.

---

### :bust_in_silhouette: User Story

**As an** application owner  
**I want to** configure denominator filter rules for my assigned applications through a model-driven visual interface  
**So that** I can adjust the addressable population criteria without requiring code changes or engineering support.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** I am an application_owner for Maestro, **When** I open the Denominator Rules section in the Filter Configuration tab, **Then** I see the available filter fields loaded from `app.DenominatorModels` (only fields where `IsFiltirable = 1`) and the currently saved rules from `app.DenominatorFilterRules`.
- **Given** I select a field (e.g., EngagementServiceCode), choose an operator (e.g., IN), and provide a value, **When** I save, **Then** the rule is persisted in `app.DenominatorFilterRules` with FK references to `DenominatorModels.DenominatorModelId` and `Applications.ApplicationId`.
- **Given** I modify a rule's operator or value, **When** I save, **Then** the old rules JSON is preserved in `app.RuleChangeAudit` and the new value is effective.
- **Given** I am a viewer, **When** I view denominator rules, **Then** edit controls are disabled.
- **Given** I configure adoption settings (adoption level, revenue metric, numerator source), **When** I save, **Then** the settings are stored per application in `app.AdoptionSettings`.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK098] Implement `GET /api/filters/denominator/:appId` — returns current rules joined with `DenominatorModels` field metadata
- [ ] [BQM-TK099] Implement `PUT /api/filters/denominator/:appId` — validates rules against `DenominatorModels` (field must exist and `IsFiltirable = 1`), persists to `app.DenominatorFilterRules`
- [ ] [BQM-TK100] Build Denominator Rules configuration panel (Motif WC) — field dropdown populated from `DenominatorModels`, operator selector based on `FieldType`, value input
- [ ] [BQM-TK101] Build Adoption Settings section — adoption level, revenue metric (dropdown from DenominatorModels number fields), numerator source
- [ ] [BQM-TK102] Write API contract and component tests (Vitest)

### :link: Links

- **Epic:** EPIC-BQM-008 (`Documentation/Backlog/epics/epic-008-denominator-rules-config.md`)
- **Architecture:** `Documentation/ProjectSpecifications/architecture.md` v1.1.0 — Denominator Model Metadata (Shared) section, DenominatorFilterRules table structure
- **Assumptions:** `Documentation/ProjectSpecifications/assumptions.md` — A12 (Shared Denominator Model), A13 (AND-combined rules)
- **PRD:** `StakeholderDocuments/AUTOMATED_SOLUTION_ARCHITECTURE.md` — Denominator Rules Configuration mockup
- **Constitution:** Principle II — configuration-driven business rules
- **Sprint:** (Assign via Milestone)

### Business Rules

- Available filter fields are determined by `DenominatorModels` where `IsFiltirable = 1` — not hardcoded.
- Operators are constrained by `FieldType`: string → EQ, NEQ, IN, NOT_IN, CONTAINS, NOT_CONTAINS; number → EQ, NEQ, GT, GTE, LT, LTE; date → GT, GTE, LT, LTE.
- Multiple rules per application are AND-combined (A13).
- Audit log captures full rules snapshot (before + after as JSON) via shared `app.RuleChangeAudit`.

### Data Impact & Pipelines

- **Reads:** `app.DenominatorModels` (shared model), `app.DenominatorFilterRules` (per-app rules), `app.AdoptionSettings` (per-app config).
- **Writes:** `app.DenominatorFilterRules`, `app.AdoptionSettings`, `app.RuleChangeAudit`.
- **Consumed by:** ADF Metrics Processing pipeline (reads DenominatorModels once → per-app DenominatorFilterRules → dynamic WHERE clause against Mercury view).
