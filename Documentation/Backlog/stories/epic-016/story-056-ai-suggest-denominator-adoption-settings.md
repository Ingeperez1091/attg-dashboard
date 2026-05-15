# BQM-US056 - Generate AI Adoption-Setting Recommendations for Denominator

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-016 (AI-Assisted Rules and Dashboard Insights)  
> **Priority**: 2 - High | **Phase**: Phase 4  
> **Changelog**: v1.0.0 - New story for AI-assisted adoption-setting recommendations.

---

### :bust_in_silhouette: User Story

**As a** application owner  
**I want to** receive AI suggestions for denominator adoption settings  
**So that** I can configure adoption level and revenue basis with guided rationale.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** authorized application context, **When** AI settings suggestion is requested, **Then** recommended adoption level and revenue basis are returned with rationale and confidence.
- **Given** recommendation output, **When** user reviews it, **Then** user can accept, edit, or reject before saving settings.
- **Given** recommendation is accepted, **When** save executes, **Then** updated settings are persisted through existing governed configuration endpoint.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK226] Implement AI recommendation endpoint for denominator adoption settings
- [ ] [BQM-TK227] Implement recommendation review UI and save handoff to existing settings API
- [ ] [BQM-TK228] Add tests for role scoping, recommendation persistence flow, and rejection no-op behavior

### :link: Links

- **Epic:** EPIC-BQM-016 (`Documentation/Backlog/epics/epic-016-ai-assisted-rules-and-dashboard-insights.md`)
- **Architecture:** `Documentation/ProjectSpecifications/architecture.md` - Sections 4.1.6, 4.2
- **Sprint:** (Assign via Milestone)

### Business Rules

- AI recommendations must include explanation metadata.
- Existing governed save path remains the only persistence mechanism.

### Data Impact & Pipelines

- **Reads:** application metadata, adoption settings history, denominator model columns.
- **Writes:** accepted-setting audit records and standard settings persistence through existing APIs.
