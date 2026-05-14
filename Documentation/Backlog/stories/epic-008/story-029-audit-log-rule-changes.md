# BQM-US029 — Audit-Log Denominator Rule Changes

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-008 (Denominator Rules Configuration)  
> **Priority**: 3 — Medium | **Phase**: Phase 2  
> **Changelog**: v1.1.0 — Updated to use shared `app.RuleChangeAudit` table; added ChangeScope discriminator; updated table references from `dbo` to `app`.

---

### :bust_in_silhouette: User Story

**As an** administrator  
**I want to** see a history of all denominator rule changes with who changed what and when  
**So that** I can audit configuration changes and troubleshoot unexpected metric shifts.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** denominator rules are modified for an application, **When** saved, **Then** an audit record is created in `app.RuleChangeAudit` with: ChangeScope = 'Denominator', user, timestamp, ApplicationId, PreviousRulesJson (full rules snapshot), NewRulesJson (full rules snapshot).
- **Given** I query the audit log for an application and ChangeScope = 'Denominator', **When** results are returned, **Then** they are ordered by timestamp descending.
- **Given** multiple rules change in one save, **When** logged, **Then** a single audit entry captures the full before/after JSON snapshot (atomic save / atomic audit).

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK106] Add `ChangeScope` column to `app.RuleChangeAudit` (values: 'Numerator', 'Denominator', 'Adoption') if not already present — migration script
- [ ] [BQM-TK107] Implement audit write logic in denominator rule save handler — capture full PreviousRulesJson / NewRulesJson per save
- [ ] [BQM-TK108] Write tests for audit completeness — verify ChangeScope filtering, JSON snapshot integrity

### :link: Links

- **Epic:** EPIC-BQM-008 (`Documentation/Backlog/epics/epic-008-denominator-rules-config.md`)
- **Architecture:** `Documentation/ProjectSpecifications/architecture.md` v1.1.0 — `app.RuleChangeAudit` table (shared for numerator + denominator)
- **Assumptions:** `Documentation/ProjectSpecifications/assumptions.md` — A12 (Shared Denominator Model), A13 (Denominator Filter Rules AND-Combined)
- **Depends on:** US030 (database schema — `RuleChangeAudit` ChangeScope migration)
- **Constitution:** Principle II — audit-log rule modifications
- **Sprint:** (Assign via Milestone)

### Business Rules

- Audit log is append-only; entries are never deleted.
- Shared `app.RuleChangeAudit` table captures both numerator and denominator rule changes, discriminated by `ChangeScope`.
- Each save produces one atomic audit entry containing the full rules JSON snapshot (not per-field entries).

### Data Impact & Pipelines

- **Writes:** `app.RuleChangeAudit` (ChangeScope = 'Denominator').
- **Reads:** Administrators query audit log filtered by ApplicationId and ChangeScope for governance reporting.
