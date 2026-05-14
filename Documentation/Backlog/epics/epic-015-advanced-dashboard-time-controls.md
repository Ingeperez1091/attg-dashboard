# EPIC-BQM-015 - Advanced Dashboard Time Controls and Trend Insights

> **Azure DevOps Work Item Type**: Epic  
> **ADO ID**: _TBD - to be assigned upon creation in Azure DevOps_  
> **ADO Link**: _TBD_  
> **Phase**: Phase 3  
> **Changelog**: v1.0.0 - New epic to capture deferred date controls, trend analysis, and benchmark alerts from stakeholder roadmap.

---

## :dart: Objective

Deliver deferred advanced dashboard insights capabilities, including date-based controls, historical trend analysis, and benchmark alerts, after baseline KPI/dashboard stability is achieved.

## :memo: Description (ADO)

As a reporting portfolio product, the dashboard must evolve beyond baseline KPI snapshots to support time-based analysis and proactive alerting so leadership can monitor directionality and performance risk over time.

## :chart_with_upwards_trend: Business Value

- Enables trend-driven decision making beyond single-snapshot KPI views.
- Improves leadership visibility with configurable period analysis and benchmark monitoring.
- Reduces manual reporting effort by embedding advanced insights in the governed dashboard.

## :white_check_mark: Acceptance Criteria

- [ ] Date and period controls are available in dashboard views with governed defaults.
- [ ] Trend visualizations are available for KPI history across approved time windows.
- [ ] Benchmark and below-target alerts are generated from governed threshold definitions.
- [ ] Advanced insights remain role-scoped and aligned to metric-definition governance.

## :link: Dependencies

- EPIC-BQM-007 (Metrics Calculation and Interim Investment Dummy Data)
- EPIC-BQM-014 (Dashboard UI and Sub Service Line Grouping)
- EPIC-BQM-013 (Investment Data Onboarding and Reconciliation)

## :clipboard: Scope

**In Scope:** Date/period selectors, KPI trend views, benchmark alert presentation, and role-scoped advanced dashboard interactions.

**Out of Scope:** Predictive forecasting models, ad hoc custom BI authoring, and external client-facing publishing.

## :book: Linked User Stories

- [ ] [BQM-US052] Implement date and period selector controls
- [ ] [BQM-US053] Implement KPI trend and historical comparison views
- [ ] [BQM-US054] Implement benchmark and below-target alerting in dashboard

## :classical_building: Architecture & Design Notes

- `Documentation/ProjectSpecifications/architecture.md` - Sections 4.1.3, 8, 9, 10
- `Documentation/ProjectSpecifications/assumptions.md` - A29, A30, A31
- `Documentation/StakeholderDocuments/ApplicationGoals.md` - Sections 16, 19

## :white_check_mark: Definition of Done (DoD)

- [ ] All linked User Stories are closed.
- [ ] Integration and UI contract testing completed.
- [ ] Date controls, trend outputs, and alerts are validated against role-scoped access.
- [ ] Epic and story traceability links added in ADO and GitHub.
