# EPIC-BQM-009 — External API Integration (Maestro & Prodigy)

> **Azure DevOps Work Item Type**: Epic  
> **ADO ID**: _TBD — to be assigned upon creation in Azure DevOps_  
> **ADO Link**: _TBD_  
> **Phase**: Phase 3

---

## :dart: Objective

Connect to Maestro and Prodigy external APIs to automatically ingest numerator data, reducing the manual upload burden for system-generated data while maintaining spreadsheet upload as a fallback/override mechanism.

## :memo: Description (ADO)

Implement automated connectors to the Maestro and Prodigy application APIs to fetch engagement/client utilization data on a scheduled basis. Fetched data follows the same ingestion path as manual uploads: stored in `stage.EngagementUsageRaw`, then validated, filtered, and used for metric calculation. The existing JSON upload endpoint must remain functional as a fallback and override mechanism for all applications.

## :chart_with_upwards_trend: Business Value

Maestro and Prodigy generate numerator data automatically from their systems. Automated ingestion eliminates manual export/upload cycles, ensures data freshness, and reduces human error. This completes the automation vision for API-sourced applications.

## :white_check_mark: Acceptance Criteria

- [ ] Automated connector fetches Maestro engagement data via API.
- [ ] Automated connector fetches Prodigy client data via API.
- [ ] Fetched data stored in `stage.EngagementUsageRaw` following the standard ingestion path.
- [ ] Connectors run on a configurable schedule.
- [ ] Manual JSON upload endpoint remains functional for all applications.
- [ ] Manual uploads can override API-fetched data when needed.
- [ ] Connector failures are logged and do not block manual upload path.
- [ ] External API integration pull requests pass the baseline CI quality gates (lint, type-check, automated tests).

## :link: Dependencies

- EPIC-BQM-003 (Numerator Ingestion API — shared staging path)
- EPIC-BQM-006 (Validation Pipeline — processes fetched data)
- EPIC-BQM-010 (CI Pipeline — baseline CI merged to protected trunk branches before epic source-code tasks begin).

## :classical_building: Architecture & Design Notes

- `Documentation/ProjectSpecifications/architecture.md` — Section 3 (Data Sources — Auto API), Section 10 (Phase 3)

## :clipboard: Scope

**In Scope:** Maestro API connector; Prodigy API connector; Scheduled fetch configuration; Fallback/override mechanism for manual uploads.

**Out of Scope:** Connectors for EYST, Vector, Navigate (remain manual/API upload); Maestro/Prodigy API authentication setup (infrastructure prerequisite).

## :book: Linked User Stories

- [ ] [BQM-US030] Connect to Maestro API for automated numerator data
- [ ] [BQM-US031] Connect to Prodigy API for automated numerator data
- [ ] [BQM-US032] Maintain manual upload as fallback/override

## :white_check_mark: Definition of Done (DoD)

- [ ] All linked User Stories are closed.
- [ ] Integration testing completed.

## :page_facing_up: PRD References

- `StakeholderDocuments/ApplicationGoals.md` — Phase 3: API Integration
- `StakeholderDocuments/AUTOMATED_SOLUTION_ARCHITECTURE.md` — Numerator Data sources (Auto-Generated)
- `.specify/memory/constitution.md` — Principle VI (Incremental Delivery — Phase 3)
