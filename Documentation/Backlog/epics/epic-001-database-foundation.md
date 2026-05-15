# EPIC-BQM-001 - Database Foundation & Seed Data
=======

> **Azure DevOps Work Item Type**: Epic  
> **ADO ID**: _TBD — to be assigned upon creation in Azure DevOps_  
> **ADO Link**: _TBD_  
> **Phase**: MVP

---

## :dart: Objective

Establish the Azure SQL database schema, staging tables, views, and seed data required for all downstream functionality. This is the foundational epic upon which every other epic depends.

## :memo: Description (ADO)

Design and implement the complete Azure SQL database schema for the BTS Quarterly Metrics Dashboard, including core tables (Applications, Roles, Users, UserApplications, filter rules, metric snapshots), the staging schema (`stage.EngagementUsageRaw`), the Denominator SQL view, and seed data for the 5 in-scope applications, 3 roles, and the super-admin user. All tables must include `CreateDate`, `CreatedBy`, `UpdateDate`, `UpdatedBy` audit columns as required by the constitution.

## :chart_with_upwards_trend: Business Value

Without the database foundation, no data can be stored, processed, or visualized. This epic unblocks all subsequent data ingestion, processing, and dashboard epics.

## :white_check_mark: Acceptance Criteria

- [ ] All core tables created in `app` schema with audit columns.
- [ ] `stage.EngagementUsageRaw` table created with columns: StageId, ApplicationId, PayloadJson, CreateDate, CreatedBy.
- [ ] External Mercury view (`vw_USTaxBTS_FY26_MaxACD`) connectivity is validated with expected columns.
- [ ] 5 applications seeded: Maestro, EYST, Prodigy, Vector, Navigate — with correct AdoptionLevel, NumeratorSource, MatchKey.
- [ ] 3 roles seeded: administrator, application_owner, viewer.
- [ ] Super-admin user seeded with full access to all applications.
- [ ] Migration scripts are versioned and repeatable.
- [ ] PowerShell setup workflow provisions the database foundation end-to-end and generates SQL project snapshot assets.
- [ ] Database pull requests pass the baseline CI quality gates (lint, type-check, automated tests).

## :link: Dependencies

- EPIC-BQM-010 (CI Pipeline - baseline CI merged to protected trunk branches before migration scripts and schema SQL are reviewed via pull request).

## :classical_building: Architecture & Design Notes

- `Documentation/ProjectSpecifications/architecture.md` - Section 4.3 (Database Layer)
- `Documentation/ProjectSpecifications/project-structure.md` - `database/` folder

## :clipboard: Scope

**In Scope:** Schema definition for all `app` and `stage` tables; external Mercury view access validation; seed scripts for applications, roles, super-admin; PowerShell automation for setup; SQL project snapshot output.

**Out of Scope:** ADF pipeline definitions (EPIC-BQM-006); API routes (EPIC-BQM-003); Frontend UI (EPIC-BQM-007, EPIC-BQM-008).

## :book: Linked User Stories

- [ ] [BQM-US001] Database schema creation
- [ ] [BQM-US002] Seed application data
- [ ] [BQM-US003] Denominator SQL view
- [ ] [BQM-US004] Staging table setup

## :white_check_mark: Definition of Done (DoD)

- [ ] All linked User Stories are closed.
- [ ] Integration testing completed.

## :page_facing_up: PRD References

- `StakeholderDocuments/ApplicationGoals.md` — Database scope
- `StakeholderDocuments/AUTOMATED_SOLUTION_ARCHITECTURE.md` — Data Storage Concept
- `StakeholderDocuments/BUSINESS_RULES_AND_ETL_SUMMARY.md` — Required Columns, Data Type Coercion
- `.specify/memory/constitution.md` — Principle I (Data Integrity First)


<!--
GitHub-Issue-Number: 
GitHub-Issue-URL: 
-->

<!--
AzureDevOps-WorkItem-Id: 0
AzureDevOps-WorkItem-Url: https://dev.azure.com/eygs3/attg-analytics-dashboard/_workitems/edit/0
-->
