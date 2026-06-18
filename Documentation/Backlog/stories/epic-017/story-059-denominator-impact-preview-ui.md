# BQM-US059 — Denominator Rules Impact Preview UI Component

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-017 (Impact Preview & Numerator Composite-Key Deduplication)  
> **Priority**: 2 — High | **Phase**: Phase 2  
> **Changelog**: v1.0.0 — Initial story; UI component showing side-by-side impact before saving denominator rules.

---

### :bust_in_silhouette: User Story

**As an** application owner  
**I want to** see a side-by-side comparison of current vs. proposed denominator impact (record count and revenue) in the configuration UI  
**So that** I can visually confirm the effect of my changes before clicking "Save Configuration."

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** I have modified denominator rules in the configuration UI, **When** I click the "Preview Impact" button, **Then** the system calls the preview API and displays: "Current: X,XXX engagements | $XXX.XXM revenue" vs. "Proposed: Y,YYY engagements | $YYY.YYM revenue".
- **Given** the preview results show a delta, **When** displayed, **Then** the count and revenue deltas are shown with directional indicators (↑ increase / ↓ decrease) and color coding (neutral/positive in green, negative/concerning in amber).
- **Given** I am satisfied with the preview, **When** I click "Save Configuration", **Then** the modified rules are persisted through the existing save API (US027).
- **Given** the preview shows unexpected results, **When** I click "Cancel" or "Revert", **Then** no changes are saved and the form returns to the last-saved state.
- **Given** the preview API returns an error (e.g., timeout, server error), **When** displayed, **Then** a non-technical error message is shown with a "Retry" option — the form state is preserved.
- **Given** the denominator count drops to zero in the proposed preview, **When** displayed, **Then** a warning indicator is shown: "Warning: Proposed rules result in an empty denominator for this application."
- **Given** I have not modified any rules, **When** the form loads, **Then** the "Preview Impact" button is disabled.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK205] Create `DenominatorImpactPreview` React component — displays current/proposed count and revenue with delta indicators.
- [ ] [BQM-TK206] Integrate "Preview Impact" button into the existing denominator rules configuration form (from EPIC-BQM-008 US027 UI).
- [ ] [BQM-TK207] Implement loading and error states for the preview call (spinner, error message, retry).
- [ ] [BQM-TK208] Add empty-denominator warning state when proposed count = 0.
- [ ] [BQM-TK209] Write component tests (render states: loading, success with increase, success with decrease, error, zero-count warning, button disabled when no changes).
- [ ] [BQM-TK210] Ensure accessibility: preview results are announced to screen readers; color coding has text alternatives.

### :link: Links

- **Epic:** EPIC-BQM-017 (`Documentation/Backlog/epics/epic-017-impact-preview-and-numerator-deduplication.md`)
- **Architecture:** `Documentation/ProjectSpecifications/architecture.md` v1.3.0 — Section 4.1 Presentation Layer (Filter Configuration tab)
- **Depends on:** BQM-US058 (Preview API endpoint must be available)
- **Related:** BQM-US027 (Denominator rule configuration UI — save flow)
- **PRD:** `StakeholderDocuments/AUTOMATED_SOLUTION_ARCHITECTURE.md` — Denominator Rules Configuration mockup, "Denominator Preview: 2,909 engagements | $162.05M revenue"
- **Constitution:** Principle II — Configuration-Driven Business Rules (preview before commit)
- **Sprint:** (Assign via Milestone)

### Business Rules

- Preview button is only enabled when the form has unsaved changes (dirty state).
- Preview results are ephemeral — they are not stored and disappear when the form is saved or cancelled.
- Revenue formatting follows locale-aware currency display (e.g., "$162.05M" for values ≥ $1M; "$45,230.00" for smaller values).
- Count formatting uses locale-aware number separators (e.g., "2,909 engagements").
- The component does not perform any writes — all persistence is delegated to the save flow (US027).

### Data Impact & Pipelines

- **Reads:** Invokes `POST /api/filters/denominator/:appId/preview` (BQM-US058).
- **Writes:** None. Save action delegates to existing `PUT /api/filters/denominator/:appId` endpoint.
- **Pipelines:** No pipeline interaction.
