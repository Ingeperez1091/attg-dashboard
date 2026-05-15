# EPIC-BQM-014 - Dashboard UI and Sub Service Line Grouping

> **Azure DevOps Work Item Type**: Epic  
> **ADO ID**: _TBD — to be assigned upon creation in Azure DevOps_  
> **ADO Link**: _TBD_  
> **Phase**: Extended-MVP B  
> **Changelog**: v1.1.0 — Added stakeholder-aligned KPI card set and accessibility/responsive UI requirements; deferred advanced time controls to EPIC-BQM-015.

---

## :dart: Objective

Implement the reporting dashboard user experience and grouping model using calculated metrics, including grouping of applications by Sub Service Line, role-scoped visibility, and baseline accessibility/responsive behavior.

## :memo: Description (ADO)

This epic delivers the presentation contract for reporting consumers: dashboard layout, KPI cards, grouping hierarchy, and interaction states. It consumes calculated metrics from EPIC-BQM-007 and does not own metric computation logic.

## :chart_with_upwards_trend: Business Value

- Delivers decision-ready visualization for leadership and application stakeholders.
- Standardizes reporting experience across portfolio, sub service line, and application levels.
- Ensures secure and role-scoped metric visibility in the UI.

## :white_check_mark: Acceptance Criteria

- [ ] Dashboard implements hero, KPI row, filter bar, grouped detail panel, and footer legend.
- [ ] Applications are grouped by `SubServiceLine` with portfolio, group, and application drill hierarchy.
- [ ] KPI cards render Investment, Revenue, Average Engagement, and On Target Rate according to current data-authority state.
- [ ] UI supports empty, in-progress, and error states with stable layout behavior.
- [ ] Role/application scoping is enforced in API and reflected in UI output.
- [ ] Dashboard baseline is keyboard navigable and supports reduced-motion behavior.
- [ ] All epic changes pass CI quality gates.

## :link: Dependencies

- EPIC-BQM-007 (Metrics Calculation and Interim Investment Dummy Data)
- EPIC-BQM-005 (Authentication and Authorization)
- EPIC-BQM-010 (Baseline CI Pipeline)
- EPIC-BQM-015 (Advanced Dashboard Time Controls and Trends)

## :clipboard: Scope

**In Scope:** Application Usage dashboard UI implementation; KPI card rendering and metadata display; Sub Service Line grouping and per-application detail rendering; UI interaction states; baseline accessibility and responsive behavior; RBAC/scoped visibility behavior.

**Out of Scope:** Metric calculation and persistence logic (EPIC-BQM-007); authoritative investment source onboarding and reconciliation (EPIC-BQM-013); date/time trend controls and advanced benchmark alerts (EPIC-BQM-015); predictive analytics and advanced custom BI authoring.

## :book: Linked User Stories

- [ ] [BQM-US025] Display metrics in Application Usage UI
- [ ] [BQM-US026] Enforce role/application metric visibility
- [ ] [BQM-US046] Group applications by Sub Service Line in dashboard
- [ ] [BQM-US051] Implement accessibility and responsive dashboard baseline

## :classical_building: Architecture & Design Notes

- `Documentation/ProjectSpecifications/architecture.md` — Sections 4.1, 4.1.1, 4.1.2, 4.1.3, 4.1.4, 10
- `Documentation/ProjectSpecifications/project-structure.md`
- `Documentation/StakeholderDocuments/ApplicationGoals.md`
- `Documentation/StakeholderDocuments/ApplicationFeatures.md`

## :white_check_mark: Definition of Done (DoD)

- [ ] All linked User Stories are closed.
- [ ] Integration and UI contract testing completed.
- [ ] Dashboard grouping behavior validated for admin and scoped users.
- [ ] Epic and story traceability links added in ADO and GitHub.
