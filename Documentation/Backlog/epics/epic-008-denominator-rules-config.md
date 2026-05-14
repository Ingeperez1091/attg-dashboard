# EPIC-BQM-008 — Denominator Rules Configuration

> **Azure DevOps Work Item Type**: Epic  
> **ADO ID**: _TBD — to be assigned upon creation in Azure DevOps_  
> **ADO Link**: _TBD_  
> **Phase**: Phase 2  
> **Changelog**: v1.1.0 — Aligned with model-driven architecture (DenominatorModels + DenominatorFilterRules); added US030 for database schema and seed data.

---

## :dart: Objective

Build the configuration UI and API for denominator filter rules per application using a **model-driven architecture**, allowing business owners to adjust the addressable population criteria without code changes. The denominator model metadata (`DenominatorModels`) defines the Mercury view columns once as a shared resource, while per-application filter rules (`DenominatorFilterRules`) reference those model fields with referential integrity.

## :memo: Description (ADO)

Implement the Denominator Rules Configuration feature using the same metadata-driven pattern established for numerator rules. This includes: (1) creating `app.DenominatorModels` as a shared model defining the Mercury view columns, (2) creating `app.DenominatorFilterRules` with FK references to both `DenominatorModels` and `Applications`, (3) building the configuration UI and API for managing per-application denominator rules, (4) enabling impact preview against the live Mercury view, (5) audit-logging all rule changes, and (6) configuring adoption settings per application.

## :chart_with_upwards_trend: Business Value

Denominator rules currently require manual configuration or code changes. A self-service configuration interface empowers business owners to adjust criteria quarterly or as business needs change, reducing turnaround time from days to minutes. The model-driven approach ensures the ADF pipeline can dynamically apply rules without code deployment.

## :white_check_mark: Acceptance Criteria

- [ ] `app.DenominatorModels` table created and seeded with ~17 Mercury view column definitions.
- [ ] `app.DenominatorFilterRules` table created with FK → `DenominatorModels` and FK → `Applications`.
- [ ] Denominator rules UI per application with model-driven filter types: rules reference `DenominatorModels` fields by ID.
- [ ] Operators supported: EQ, NEQ, GT, GTE, LT, LTE, IN, NOT_IN, CONTAINS, NOT_CONTAINS.
- [ ] Rules preview shows impact (record count, revenue total) before saving.
- [ ] `application_owner` can edit denominator rules for assigned applications.
- [ ] `viewer` sees rules in read-only mode.
- [ ] `administrator` can edit rules for all applications.
- [ ] API endpoints `GET/PUT /api/filters/denominator/:appId` function correctly.
- [ ] All rule changes audit-logged via shared `app.RuleChangeAudit` table (user, old JSON, new JSON, timestamp).
- [ ] Adoption settings configurable per app (Adoption Level, Revenue Metric, Numerator Source).
- [ ] Denominator rules configuration pull requests pass the baseline CI quality gates (lint, type-check, automated tests).

## :link: Dependencies

- EPIC-BQM-001 (Database Foundation — base schema and `Applications` table)
- EPIC-BQM-006 (Numerator Filter Config — establishes model-driven pattern with `ApplicationModels` + `NumeratorFilterRules`)
- EPIC-BQM-005 (Auth — role-based editing)
- EPIC-BQM-010 (CI Pipeline — baseline CI merged to protected trunk branches before epic source-code tasks begin)

## :classical_building: Architecture & Design Notes

- `Documentation/ProjectSpecifications/architecture.md` v1.1.0 — Denominator Model Metadata (Shared) section; DenominatorModels & DenominatorFilterRules table structures; Denominator relationship diagram; ADF Metrics Processing pipeline (dual-model lookups)
- `Documentation/ProjectSpecifications/assumptions.md` — A12 (Shared Denominator Model), A13 (Denominator Filter Rules AND-Combined)
- Design pattern: Same metadata-driven approach as numerator (`ApplicationModels` → `NumeratorFilterRules`), but the denominator model is **shared** (no `ApplicationId`) because the Mercury view schema is identical across all 5 applications.

## :clipboard: Scope

**In Scope:** DenominatorModels DDL + seed data; DenominatorFilterRules DDL; Denominator filter rules CRUD API; Denominator Configuration UI within Filter Configuration tab; Impact preview (count + revenue before/after); Audit logging for rule changes (shared `RuleChangeAudit` table); Adoption settings configuration.

**Out of Scope:** Numerator filter configuration (EPIC-BQM-006); Pipeline re-run triggers on config change (future); Mercury view DDL changes (managed externally).

## :book: Linked User Stories

- [ ] [BQM-US027] Denominator rule configuration UI
- [ ] [BQM-US028] Preview denominator count impact before saving
- [ ] [BQM-US029] Audit-log denominator rule changes
- [ ] [BQM-US030] Denominator model database schema and seed data

## :white_check_mark: Definition of Done (DoD)

- [ ] All linked User Stories are closed.
- [ ] Integration testing completed.
- [ ] Architecture traceability verified (`Documentation/ProjectSpecifications/architecture.md` v1.1.0 referenced).

## :page_facing_up: PRD References

- `StakeholderDocuments/ApplicationGoals.md` — Phase 2: Denominator Rules Configuration
- `StakeholderDocuments/AUTOMATED_SOLUTION_ARCHITECTURE.md` — Denominator Rules Configuration mockup, Current Application Rules Summary
- `StakeholderDocuments/BUSINESS_RULES_AND_ETL_SUMMARY.md` — Business Rules per application
- `.specify/memory/constitution.md` — Principle II (Configuration-Driven Business Rules)
