# BQM-US023 - Calculate Adoption and Revenue Metrics

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-007 (Metrics Calculation and Interim Investment Dummy Data)  
> **Priority**: 1 — Critical | **Phase**: Extended-MVP A  
> **Changelog**: v2.0.0 — Story aligned to EPIC-BQM-007 split; retains metric-calculation focus.

---

### :bust_in_silhouette: User Story

**As a** data consumer  
**I want to** have adoption and revenue percentages calculated automatically per application  
**So that** utilization KPIs are accurate and reproducible.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** matched records and filtered denominator for an application, **When** metric calculation executes, **Then** `AdoptionPct` is calculated as `(MatchedCount / DenominatorCount) * 100`.
- **Given** revenue metrics are enabled, **When** calculation executes, **Then** `RevenuePct` is calculated as `(NumeratorRevenue / DenominatorRevenue) * 100`.
- **Given** engagement-level applications, **When** adoption is calculated, **Then** counts use engagement identifiers.
- **Given** client-level applications, **When** adoption is calculated, **Then** counts use distinct client identifiers.
- **Given** `AdoptionSettings.RevenueMetric` is configured, **When** revenue is calculated, **Then** the configured ETD/FYTD denominator column is used.
- **Given** zero denominator counts or values, **When** calculation runs, **Then** divide-by-zero conditions are handled without runtime failure.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK085] Implement metric calculation logic for Adoption % and Revenue % using validated pipeline outputs
- [ ] [BQM-TK086] Implement client-level distinct counting rules for client-based applications
- [ ] [BQM-TK087] Apply revenue basis configuration (`ETD_ANSRAmt` / `FYTD_ANSRAmt`) through `AdoptionSettings`
- [ ] [BQM-TK088] Add integration tests for engagement/client-level formulas and zero-denominator handling

### :link: Links

- **Epic:** EPIC-BQM-007 (`Documentation/Backlog/epics/epic-007-metrics-calculation-dashboard.md`)
- **Architecture:** `Documentation/ProjectSpecifications/architecture.md` — Sections 4.4, 5.3
- **Assumptions:** `Documentation/ProjectSpecifications/assumptions.md` — A20, A22, A23
- **Sprint:** (Assign via Milestone)

### Business Rules

- Engagement-based apps use engagement keys; client-based apps use distinct client keys.
- Revenue basis comes from per-application configuration.
- Calculation is deterministic for equivalent input datasets.

### Data Impact & Pipelines

- **Reads:** `app.MatchedRecords`, filtered denominator set, `app.AdoptionSettings`.
- **Writes:** Calculation outputs consumed by snapshot persistence in US024.
