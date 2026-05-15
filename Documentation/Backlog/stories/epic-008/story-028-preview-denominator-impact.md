# BQM-US028 — Preview Denominator Count Impact Before Saving

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-008 (Denominator Rules Configuration)  
> **Priority**: 2 — High | **Phase**: Phase 2  
> **Changelog**: v1.1.0 — Aligned with model-driven architecture; preview builds dynamic SQL from DenominatorModels field→column mapping.

---

### :bust_in_silhouette: User Story

**As an** application owner  
**I want to** preview how denominator rule changes affect the addressable population count and revenue before saving  
**So that** I can verify the impact of my changes and avoid unintended metric distortions.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** I modify a denominator rule (e.g., change EngagementServiceCode from IN('TAX','AUDIT') to IN('TAX')), **When** I click "Preview", **Then** I see: current count/revenue vs. projected count/revenue.
- **Given** the preview loads, **When** displayed, **Then** format is: "Denominator Preview: X,XXX engagements | $XXX.XXM revenue".
- **Given** I am satisfied with the preview, **When** I click "Save Configuration", **Then** the rules are persisted.
- **Given** the preview shows unexpected results, **When** I click "Cancel", **Then** no changes are saved.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK103] Implement `POST /api/filters/denominator/:appId/preview` endpoint — accepts proposed rules, resolves `DenominatorModelId` → `SourceColumn` via `DenominatorModels`, builds parameterized dynamic WHERE clause against Mercury view
- [ ] [BQM-TK104] Build preview component showing count + revenue impact side-by-side (current rules vs. proposed)
- [ ] [BQM-TK105] Write tests for preview accuracy — verify dynamic SQL generation from model field mappings

### :link: Links

- **Epic:** EPIC-BQM-008 (`Documentation/Backlog/epics/epic-008-denominator-rules-config.md`)
- **Architecture:** `Documentation/ProjectSpecifications/architecture.md` v1.1.0 — DenominatorModels `SourceColumn` field enables dynamic SQL; ADF pipeline uses same model→column mapping
- **Assumptions:** `Documentation/ProjectSpecifications/assumptions.md` — A12 (shared model), A13 (AND-combined rules)
- **PRD:** `StakeholderDocuments/AUTOMATED_SOLUTION_ARCHITECTURE.md` — "Denominator Preview: 2,909 engagements | $162.05M revenue"
- **Constitution:** Principle II — preview impact before applying
- **Sprint:** (Assign via Milestone)

### Business Rules

- Preview applies proposed rules against current denominator data in real-time. No save during preview.
- Dynamic SQL is built using `DenominatorModels.SourceColumn` to map logical field names to actual Mercury view column names.
- Revenue column for the revenue total is determined by `AdoptionSettings.RevenueMetric` for the application.
- Rules are AND-combined (A13).

### Data Impact & Pipelines

- **Reads:** `app.DenominatorModels` (shared, ~17 rows), `app.AdoptionSettings` (per-app — determines revenue column), Mercury view `[InventoryAnalysis].[dbo].[vw_USTaxBTS_FY26_MaxACD]`.
- **Writes:** None (read-only preview). Writes occur only on subsequent save via US027.
