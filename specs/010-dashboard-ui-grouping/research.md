# Research: Dashboard UI and Sub Service Line Grouping (EPIC-BQM-014)

## R1 - Dashboard Composition Contract

**Task**: Determine the required baseline layout and section composition for the Application Usage dashboard.

**Decision**: Implement a fixed five-section contract: hero area, KPI row, filter bar, grouped detail panel, and footer legend.

**Rationale**:
- Architecture documentation explicitly defines this section structure as the dashboard contract.
- Keeping a stable section model supports consistency across empty, in-progress, and error states.
- This aligns with stakeholder expectations for decision-ready reporting.

**Alternatives considered**:
- **Minimal KPI-only page**: Rejected because it omits required grouping/detail context.
- **Free-form component layout**: Rejected due to inconsistent user experience and weak traceability to architecture contract.

---

## R2 - Grouping and Aggregation Hierarchy

**Task**: Determine how metric results should be organized for dashboard consumption.

**Decision**: Use a three-level hierarchy: portfolio rollups, Sub Service Line rollups, and application rows.

**Rationale**:
- Stakeholder goals define portfolio -> sub service line -> product organization as canonical analysis flow.
- This grouping supports direct mapping to the epic acceptance criteria for Sub Service Line grouping.
- Hierarchical grouping is independently testable and role-scope friendly.

**Alternatives considered**:
- **Flat application list only**: Rejected because it loses required business hierarchy context.
- **Application-first grouping with optional categories**: Rejected because it conflicts with the stated rollup-first decision model.

---

## R3 - Role-Scoped Visibility Enforcement

**Task**: Determine where authorization scoping must be enforced for dashboard data.

**Decision**: Enforce scope server-side in API/service boundaries and return only authorized grouped data.

**Rationale**:
- Constitution Principle V requires server-side authorization checks before processing.
- Client-only filtering risks exposure of unauthorized application metrics.
- Existing role/application assignment model already provides required security boundaries.

**Alternatives considered**:
- **Client-side filtering after full payload retrieval**: Rejected due to data leakage risk.
- **UI-only hidden rows**: Rejected because unauthorized data still traverses transport layer.

---

## R4 - UI State Behavior (Empty, In-Progress, Error)

**Task**: Define state behavior requirements when data is unavailable, processing, or failed.

**Decision**: Preserve dashboard layout while showing explicit state messaging for empty, in-progress, and error scenarios.

**Rationale**:
- Architecture requirements explicitly call for stable layout and clear non-technical messaging.
- Maintaining consistent structure reduces confusion and improves trust.
- This behavior is measurable and testable in integration tests.

**Alternatives considered**:
- **Hide content areas on error**: Rejected because it reduces orientation and creates abrupt UX changes.
- **Generic loading/error page replacement**: Rejected because it discards dashboard context and section continuity.

---

## R5 - Accessibility and Responsive Baseline

**Task**: Determine minimum accessibility and responsive requirements for EPIC-BQM-014.

**Decision**: Require keyboard navigability for filter/grouping controls, reduced-motion support, and readable mobile/desktop layouts.

**Rationale**:
- Stakeholder and architecture documents explicitly require accessibility baseline and responsive behavior.
- This can be validated via deterministic interaction and viewport tests.
- It enables inclusive access without waiting for a later epic.

**Alternatives considered**:
- **Desktop-only baseline**: Rejected due to explicit responsive requirement.
- **Accessibility deferred to future release**: Rejected because it is in current acceptance criteria.

---

## R6 - Ownership Boundary with Metrics Processing

**Task**: Clarify implementation boundary between EPIC-BQM-014 and EPIC-BQM-007.

**Decision**: EPIC-BQM-014 consumes persisted metrics and run status only; it does not own formula calculation or snapshot persistence logic.

**Rationale**:
- Architecture ownership explicitly assigns metric computation to EPIC-BQM-007.
- Avoids cross-epic coupling and logic duplication.
- Preserves clean architecture and reduces regression risk.

**Alternatives considered**:
- **Recompute KPIs in UI service layer**: Rejected due to governance and reproducibility violations.
- **Introduce dashboard-specific metric tables**: Rejected due to duplicated source-of-truth and maintenance burden.

---

## Implementation Notes - 2026-05-08

- Added a dedicated dashboard run-state route so the UI can query recalculation context without expanding the usage contract.
- Normalized null and blank Sub Service Line values through a shared `Unassigned` fallback label so grouping and filtering behave consistently.
- Implemented roving-tab keyboard semantics for the dashboard filter bar and linked the active tab to the detail panel with `aria-controls` and `tabpanel` semantics.
- Hardened the dashboard stylesheet with explicit focus-visible, reduced-motion, and small-screen layout rules instead of relying on incidental browser defaults.
- Kept performance verification at the route/in-memory integration boundary to validate the dashboard contract without introducing UI-layer metric recomputation.
