# EPIC-BQM-013 - Investment Data Onboarding and Reconciliation

> **Azure DevOps Work Item Type**: Epic  
> **ADO ID**: _TBD - to be assigned upon creation in Azure DevOps_  
> **ADO Link**: _TBD_  
> **Phase**: Extended-MVP C  
> **Changelog**: v2.1.0 - Added stakeholder-aligned investment revision/backfill and financial-data governance controls.

---

## :dart: Objective

Onboard an authoritative investment data source and reconciliation controls so investment-aware KPIs can be produced with governance and auditability.

## :memo: Description (ADO)

As a reporting platform, the product must ingest governed investment data, normalize it to portfolio reporting standards, and reconcile output quality so investment KPIs can move from interim synthetic values to trusted production-grade metrics.

## :chart_with_upwards_trend: Business Value

- Enables complete KPI coverage including investment efficiency dimensions.
- Improves confidence in financial reporting through traceable reconciliation.
- Reduces manual correction cycles by implementing exception handling and data quality controls.

## :white_check_mark: Acceptance Criteria

- [ ] Authoritative source contract, grain, and mapping are approved by data owners.
- [ ] Ingestion and normalization pipeline is implemented for investment data with validation controls.
- [ ] Reconciliation and exception reporting are available per run and period.
- [ ] Currency, fiscal-period, and revision/backfill policies are enforced in the governed financial dataset.
- [ ] Downstream KPI consumption uses approved, reconciled investment outputs.

## :link: Dependencies

- EPIC-BQM-006 (Validation and Processing Pipeline)
- EPIC-BQM-007 (Metrics Calculation and Interim Investment Dummy Data)
- EPIC-BQM-011 (Azure Infrastructure IaC)

## :clipboard: Scope

**In Scope:** Investment source onboarding governance, mapping, ingestion pipeline, normalization standards, reconciliation outputs, exception traceability, and governed revision/backfill controls.

**Out of Scope:** Dashboard UI composition and grouping behavior, non-investment KPI formula redesign, and external publishing beyond governed internal consumption.

## :book: Linked User Stories

- [ ] [BQM-US042] Approve investment source contract and mapping
- [ ] [BQM-US043] Implement investment ingestion and normalization
- [ ] [BQM-US044] Implement investment reconciliation and exception reporting
- [ ] [BQM-US050] Implement investment revision and backfill governance controls

## :classical_building: Architecture & Design Notes

- `Documentation/ProjectSpecifications/architecture.md` - Sections 3, 4.4, 5, 10
- `Documentation/ProjectSpecifications/assumptions.md` - A26, A27, A28
- `Documentation/StakeholderDocuments/ApplicationGoals.md`

## :white_check_mark: Definition of Done (DoD)

- [ ] All linked User Stories are closed.
- [ ] Integration testing completed.
- [ ] Investment data is ingested and reconciled in non-production.
- [ ] Investment-ready dataset is approved for downstream KPI usage.


