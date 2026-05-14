# Quickstart: Dashboard UI and Sub Service Line Grouping (EPIC-BQM-014)

**Feature Branch**: `010-dashboard-ui-grouping`  
**Date**: 2026-05-07

## Purpose

Implement and validate dashboard UI grouping, role-scoped visibility, and baseline state/accessibility/responsive behavior while consuming persisted metric snapshots.

## Prerequisites

1. Current branch is `010-dashboard-ui-grouping`.
2. Existing metrics retrieval and run-status pathways are available (EPIC-BQM-007 dependencies).
3. Authentication and role/application assignment model is active (EPIC-BQM-005 dependencies).

## Implementation Sequence

1. Implement dashboard composition shell
- Build required sections: hero, KPI row, filter bar, grouped detail panel, footer legend.
- Keep route/components thin and isolate orchestration in application service layer.

2. Implement grouped view model orchestration
- Build grouped hierarchy (portfolio -> Sub Service Line -> application).
- Add Sub Service Line filtering behavior (all + single-group selection).

3. Implement role-scoped retrieval behavior
- Enforce server-side application scoping before group aggregation.
- Ensure non-admin users cannot retrieve unauthorized application data.

4. Implement UI state model
- Add explicit `ready`, `empty`, `inProgress`, `error` states.
- Preserve dashboard structure across all states.

5. Implement accessibility/responsive baseline
- Ensure keyboard navigation across filter/group controls.
- Respect reduced-motion preferences.
- Verify KPI/grouped detail readability on mobile and desktop.

## Verification Steps

1. Grouping correctness verification
- Confirm hierarchy renders in required order and rollups map to scoped data.

2. RBAC verification
- Validate administrator vs application_owner/viewer payload visibility across assigned and unassigned applications.

3. State behavior verification
- Confirm empty, in-progress, and error states render with stable section layout and non-technical messaging.

4. Accessibility/responsive verification
- Validate keyboard-only operation of primary dashboard controls.
- Validate reduced-motion behavior and readable mobile layout.

Recommended local verification commands:

```bash
npx vitest run tests/integration/metrics/dashboard-accessibility-keyboard.integration.test.ts tests/integration/metrics/dashboard-reduced-motion.integration.test.ts tests/integration/metrics/dashboard-responsive-layout.integration.test.ts tests/integration/metrics/dashboard-performance.integration.test.ts
```

```bash
npm run type-check
```

5. Contract conformance verification
- Validate API response shape and error matrix against `contracts/dashboard-ui-grouping-contract.md`.

6. Aggregation boundary verification
- Verify aggregation occurs in API/application service layer, not in frontend KPI calculation logic.
- Verify frontend filtering cannot expand authorization scope beyond server-returned `applicationIds`.

## Test Strategy

- Unit tests:
  - Grouping transformer/service logic
  - State resolution logic
  - Status-chip derivation behavior
- Contract tests:
  - Dashboard usage payload schema
  - Error payload/status code semantics
- Integration tests:
  - End-to-end dashboard retrieval with scoped users
  - Empty/in-progress/error state rendering behavior
  - Sub Service Line filtering with grouped results
  - Keyboard navigation semantics for filter/detail focus flow
  - Reduced-motion and responsive stylesheet guarantees
  - Performance smoke coverage for standard-scope dashboard retrieval under 3 seconds

## Completion Criteria

- All success criteria from `spec.md` are met.
- Constitution checks remain PASS after implementation.
- CI quality gates pass (`lint`, `type-check`, `test`).
- No unresolved clarification markers are introduced.
- Playwright evidence is recorded when browser infrastructure is available locally.
