# EPIC-BQM-004 — Numerator Filter Configuration

> **Azure DevOps Work Item Type**: Epic  
> **ADO ID**: _TBD — to be assigned upon creation in Azure DevOps_  
> **ADO Link**: _TBD_  
> **Phase**: MVP

---

## :dart: Objective

Build the UI and API for configuring numerator filter rules per application, using the metadata-driven `ApplicationModels` table to dynamically determine which fields are available for filtering. Application owners and administrators define field-operator-value expressions that control how numerator data is filtered before metric calculation. The filter field dropdown is populated from model-defined fields marked `IsFiltirable`, ensuring referential integrity between rules and the application's actual data structure.

## :memo: Description (ADO)

Implement the Numerator Filter Configuration interface as part of the Filter Configuration tab. Each application must have independently configurable numerator filter rules supporting dynamic field-operator-value expressions (e.g., `NavigateStatus = Navigate`, `RevenueFYTD >= 20000`). The available filter fields are driven by the `ApplicationModels` metadata table — only fields where `IsFiltirable = 1` appear in the field selector. Application owners can edit filters for their assigned applications. Viewers see filters in read-only mode. Administrators can edit filters for all applications. This design ensures a single generic pipeline in ADF can apply filters for any application without code changes.

## :chart_with_upwards_trend: Business Value

Business owners need to control which numerator records qualify for adoption metrics without requiring engineering changes. Configuration-driven rules ensure flexibility and reduce manual intervention cycles.

## :white_check_mark: Acceptance Criteria

- [ ] Numerator filter rules UI displays per-application filters with field names sourced from `ApplicationModels` (where `IsFiltirable = 1`).
- [ ] Users can create field-operator-value filter expressions where the field dropdown is populated from the application's model metadata.
- [ ] `NumeratorFilterRules.ApplicationModelId` references a valid `ApplicationModels` record (referential integrity enforced).
- [ ] `application_owner` can edit filters for assigned applications only.
- [ ] `viewer` can view filters in read-only mode.
- [ ] `administrator` can edit filters for all applications.
- [ ] API endpoints `GET/PUT /api/filters/numerator/:appId` function correctly and return/accept model-aware filter definitions.
- [ ] Filter rule changes are audit-logged (user, previous value, timestamp).
- [ ] Numerator filter configuration pull requests pass the baseline CI quality gates (lint, type-check, automated tests).

## :link: Dependencies

- EPIC-BQM-001 (Database Foundation — `ApplicationModels` and `NumeratorFilterRules` tables)
- EPIC-BQM-002 (User Administration — role/application assignment for access control)
- EPIC-BQM-010 (CI Pipeline — baseline CI merged to protected trunk branches before epic source-code tasks begin).

## :classical_building: Architecture & Design Notes

- `Documentation/ProjectSpecifications/architecture.md` — Section 4.2 (API—Filters), Section 4.1 (Tab Access Matrix), Section 4.3 (Application Model Metadata, Per-Application Payload Templates)
- `Documentation/ProjectSpecifications/assumptions.md` — A15 (Metadata-Driven Application Models), A16 (Filter Rules Reference Model Fields)

## :clipboard: Scope

**In Scope:** Numerator filter rules CRUD API; Filter Configuration tab — Numerator section; Dynamic field selector powered by `ApplicationModels` metadata; Role-based access enforcement on filter editing; Audit logging for rule changes; Seed application model field definitions for all five applications.

**Out of Scope:** Denominator rules configuration (EPIC-BQM-008); Pipeline execution of filters (EPIC-BQM-006); ApplicationModels CRUD UI for adding new applications or modifying field schemas (administrative task done via seed/migration scripts in EPIC-BQM-001).

## :book: Linked User Stories

- [ ] [BQM-US013] View numerator filter rules per application (model-driven field display)
- [ ] [BQM-US014] Create/edit numerator filter rules (field selector from ApplicationModels)
- [ ] [BQM-US015] Filter rules respect role and application assignment
- [ ] [BQM-US016] Seed application model definitions for all five applications

## :white_check_mark: Definition of Done (DoD)

- [ ] All linked User Stories are closed.
- [ ] Integration testing completed.

## :page_facing_up: PRD References

- `StakeholderDocuments/ApplicationGoals.md` — Phase 1: "Create Numerator filter interface"
- `StakeholderDocuments/ApplicationFeatures.md` — Numerator and Denominator data filter
- `StakeholderDocuments/AUTOMATED_SOLUTION_ARCHITECTURE.md` — Numerator filter UI mockup; Metadata-based architecture; Per-application payload templates
- `StakeholderDocuments/BUSINESS_RULES_AND_ETL_SUMMARY.md` — Per-application business rules and field definitions
- `.specify/memory/constitution.md` — Principle II (Configuration-Driven Business Rules)
