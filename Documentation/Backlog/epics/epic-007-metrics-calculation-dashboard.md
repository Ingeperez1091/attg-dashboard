# EPIC-BQM-007 - Metrics Calculation and Interim Investment Dummy Data

> **Azure DevOps Work Item Type**: Epic  
> **ADO ID**: _TBD — to be assigned upon creation in Azure DevOps_  
> **ADO Link**: _TBD_  
> **Phase**: Extended-MVP A  
> **Changelog**: v2.1.0 — Added KPI-expansion alignment (On Target Rate, Average Engagement, metric metadata contract) while preserving split ownership with EPIC-BQM-014.

---

## :dart: Objective

Deliver governed KPI calculations (adoption, revenue, On Target Rate, and Average Engagement) from pipeline outputs and provide an interim investment dummy dataset in SQL so KPI development can proceed before authoritative investment source onboarding.

## :memo: Description (ADO)

As a portfolio reporting solution, the product must convert validated pipeline outputs into governed KPI snapshots, including On Target Rate and Average Engagement outputs with metric-version metadata, and make an interim, clearly-labeled investment dummy dataset available in the database for controlled development and testing. Dashboard UI delivery and grouping behavior are split into EPIC-BQM-014.

## :chart_with_upwards_trend: Business Value

- Converts processed data into decision-ready adoption and revenue KPIs.
- Eliminates spreadsheet metric calculation drift.
- Unblocks investment KPI development with governed interim seed data until EPIC-BQM-013 is delivered.

## :white_check_mark: Acceptance Criteria

- [ ] Adoption and revenue metrics are calculated from validated matched records.
- [ ] On Target Rate and Average Engagement values are calculated using approved threshold and aggregation rules.
- [ ] Metric snapshots are persisted with calculation timestamp, run id, application id, and metric-definition metadata.
- [ ] Interim investment dummy dataset is generated and stored in SQL with explicit synthetic-data flag.
- [ ] Dummy investment data is seeded by migration/seed script and tied to ApplicationId and CalculationDate.
- [ ] Metrics API model can expose dummy investment values as non-authoritative when requested by authorized consumers.
- [ ] All epic changes pass CI quality gates.

## :link: Dependencies

- EPIC-BQM-001 (Database Foundation)
- EPIC-BQM-003 (Numerator Ingestion API)
- EPIC-BQM-004 (Numerator Filter Configuration)
- EPIC-BQM-005 (Authentication and Authorization)
- EPIC-BQM-006 (Validation and Processing Pipeline)
- EPIC-BQM-008 (Denominator Rules Configuration)
- EPIC-BQM-010 (Baseline CI Pipeline)

## :clipboard: Scope

**In Scope:** Metric snapshot calculation and persistence; metrics retrieval API contract; KPI outputs for adoption, revenue, On Target Rate, and Average Engagement; SQL schema and seed scripts for interim investment dummy data; non-authoritative investment dummy value retrieval for downstream KPI development; metric freshness and run traceability metadata.

**Out of Scope:** Dashboard UI composition and grouping behavior (EPIC-BQM-014); authoritative investment source onboarding and reconciliation (EPIC-BQM-013); external client-facing publishing.

## :book: Linked User Stories

- [ ] [BQM-US023] Calculate adoption and revenue metrics
- [ ] [BQM-US024] Persist historical metric snapshots
- [ ] [BQM-US045] Generate and persist interim investment dummy dataset
- [ ] [BQM-US047] Calculate On Target Rate and Average Engagement metrics

## :classical_building: Architecture & Design Notes

- `Documentation/ProjectSpecifications/architecture.md` — Sections 4.3.1, 4.4, 5.3, 10
- `Documentation/ProjectSpecifications/assumptions.md` — A20, A22, A23
- `Documentation/Backlog/epics/epic-014-dashboard-ui-grouping.md`
- `Documentation/StakeholderDocuments/ApplicationGoals.md`
- `Documentation/StakeholderDocuments/ApplicationFeatures.md`

## :white_check_mark: Definition of Done (DoD)

- [ ] All linked User Stories are closed.
- [ ] Integration and contract testing completed.
- [ ] Adoption/revenue metrics and interim investment dummy data are queryable in non-production flows.
- [ ] Epic and story traceability links added in ADO and GitHub.
