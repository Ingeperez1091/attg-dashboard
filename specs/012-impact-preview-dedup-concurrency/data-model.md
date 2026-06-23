# Data Model: Impact Preview, Composite-Key Deduplication & Concurrent Rules Editing

**Feature Branch**: `012-impact-preview-dedup-concurrency`  
**Generated**: 2026-06-12  
**Updated**: 2026-06-14 — Added DenominatorFilterRulesPreview entity (Option D staging table); corrected migration numbering (031–037)  
**Status**: Complete

---

## Entity Definitions

### DenominatorFilterRulesPreview (New — stage schema)

Session-scoped transient staging table for proposed denominator rules during impact preview (Option D). Rows are inserted when a preview is requested and deleted immediately after pipeline execution. Orphaned rows are purged by TTL.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| PreviewId | UNIQUEIDENTIFIER | PK, DEFAULT NEWID() | |
| SessionId | UNIQUEIDENTIFIER | NOT NULL | Scopes rules to a single preview request |
| ApplicationId | UNIQUEIDENTIFIER | NOT NULL, FK → app.Applications | |
| DenominatorModelId | UNIQUEIDENTIFIER | NOT NULL, FK → app.DenominatorModels | Column resolution via JOIN |
| Operator | NVARCHAR(32) | NOT NULL, CHECK IN (...) | Same operators as DenominatorFilterRules |
| Value | NVARCHAR(512) | NOT NULL | Filter value (e.g., '11420;11421') |
| RuleOrder | INT | NOT NULL | Execution order within session |
| CreateDate | DATETIME2 | NOT NULL, DEFAULT SYSUTCDATETIME() | |
| ExpiresAt | DATETIME2 | NOT NULL, DEFAULT DATEADD(HOUR, 1, SYSUTCDATETIME()) | TTL for orphan cleanup |

**TypeScript Entity**:
```typescript
export interface DenominatorPreviewRule {
  previewId: string;
  sessionId: string;
  applicationId: string;
  denominatorModelId: string;
  operator: DenominatorOperator;
  value: string;
  ruleOrder: number;
  createDate: string;
  expiresAt: string;
}
```

**Validation Rules**:
- `Operator` CHECK: `IN ('EQUALS', 'NOT_EQUALS', 'CONTAINS', 'NOT_CONTAINS', 'IN_LIST', 'NOT_IN_LIST', 'GREATER_THAN', 'GREATER_OR_EQUAL', 'LESS_THAN', 'LESS_OR_EQUAL')`
- `DenominatorModelId` must reference valid filterable model (FK + `IsFiltirable = 1` enforced at API layer)
- Multiple rows per `SessionId` allowed (one rule set = N rows)
- Rows are ephemeral — deleted after pipeline completion; orphans purged by `ExpiresAt` TTL

**Indexes**:
- PK: `PreviewId` — clustered
- IX: `(SessionId, ApplicationId) INCLUDE (DenominatorModelId, Operator, Value, RuleOrder)` — covering index for SP rule load
- IX: `(ExpiresAt)` — for TTL cleanup job

**Lifecycle**:
```
[None] → POST /preview → INSERT (session-scoped rows)
INSERT → Pipeline runs → Pipeline completes → DELETE WHERE SessionId = @sessionId
INSERT → API crash (no delete) → 1 hour passes → SQL Agent purges via ExpiresAt
```

---

### ConfigVersion (New)

Tracks the monotonic version counter per application per rule scope for optimistic concurrency control.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| ApplicationId | UNIQUEIDENTIFIER | PK (composite), FK → app.Applications | |
| RuleScope | NVARCHAR(32) | PK (composite), CHECK IN ('Denominator', 'Numerator') | Decoupled version per scope |
| Version | INT | NOT NULL, DEFAULT 1 | Monotonically incremented on save |
| LastModifiedBy | NVARCHAR(255) | NOT NULL | Azure AD user ID of last saver |
| LastModifiedAt | DATETIME2 | NOT NULL, DEFAULT SYSUTCDATETIME() | Timestamp of last version increment |

> **Audit Column Deviation (Constitution I)**: This table uses `LastModifiedBy`/`LastModifiedAt` instead of the canonical `CreateDate`/`CreatedBy`/`UpdateDate`/`UpdatedBy` quad. Justification: ConfigVersions rows are seeded once (immutable creation) and only the latest modifier matters — the monotonic `Version` counter itself serves as the creation/update audit trail. Adding four extra columns would be semantically redundant.

**TypeScript Entity**:
```typescript
export type RuleScope = 'Denominator' | 'Numerator';

export interface ConfigVersion {
  applicationId: string;
  ruleScope: RuleScope;
  version: number;
  lastModifiedBy: string;
  lastModifiedAt: string;
}
```

**Validation Rules**:
- `Version` MUST only increase (never decrement or reset)
- `RuleScope` constrained to known values via CHECK constraint
- Each `(ApplicationId, RuleScope)` pair has exactly one row

**State Transitions**:
```
Version N → Save with matching version → Version N+1
Version N → Save with stale version → REJECTED (409 Conflict)
Version N → Force-save (admin) → Version N+1 (bypasses version check)
```

---

### ConfigEditSession (New)

Tracks active editing sessions for advisory presence warnings.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| SessionId | UNIQUEIDENTIFIER | PK, DEFAULT NEWID() | |
| ApplicationId | UNIQUEIDENTIFIER | NOT NULL, FK → app.Applications | |
| RuleScope | NVARCHAR(32) | NOT NULL, CHECK IN ('Denominator', 'Numerator') | |
| UserId | NVARCHAR(255) | NOT NULL | Azure AD user ID of editor |
| DisplayName | NVARCHAR(256) | NULL | Cached display name for UI |
| SessionStart | DATETIME2 | NOT NULL, DEFAULT SYSUTCDATETIME() | |
| LastHeartbeat | DATETIME2 | NOT NULL, DEFAULT SYSUTCDATETIME() | Updated by PATCH heartbeat |
| IsActive | BIT | NOT NULL, DEFAULT 1 | Set to 0 on explicit release |

> **Audit Column Deviation (Constitution I)**: This table uses `SessionStart`/`UserId` instead of canonical `CreateDate`/`CreatedBy`/`UpdateDate`/`UpdatedBy`. Justification: edit sessions are ephemeral (5-min TTL), single-actor (UserId = creator = updater), and auto-cleaned — `SessionStart` is the creation timestamp and `LastHeartbeat` is the update timestamp. Adding redundant audit columns to a transient advisory table provides no governance value.

**TypeScript Entity**:
```typescript
export interface ConfigEditSession {
  sessionId: string;
  applicationId: string;
  ruleScope: RuleScope;
  userId: string;
  displayName: string | null;
  sessionStart: string;
  lastHeartbeat: string;
  isActive: boolean;
}

export interface ActiveEditor {
  userId: string;
  displayName: string | null;
  sessionStart: string;
}
```

**Validation Rules**:
- A user can have at most one active session per `(ApplicationId, RuleScope)` — enforced by UNIQUE constraint on `(ApplicationId, RuleScope, UserId) WHERE IsActive = 1`
- Sessions expire after 5 minutes without heartbeat: `LastHeartbeat < DATEADD(MINUTE, -5, SYSUTCDATETIME())`
- Viewers MUST NOT register sessions (enforced at API layer)

**State Transitions**:
```
[None] → POST register → Active (IsActive=1, LastHeartbeat=now)
Active → PATCH heartbeat → Active (LastHeartbeat=updated)
Active → DELETE release → Inactive (IsActive=0)
Active → 5min without heartbeat → Stale (cleaned on next query)
```

---

### RuleChangeAudit (Extended)

Existing table extended with force-save governance fields.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| AuditId | UNIQUEIDENTIFIER | PK (existing) | |
| ApplicationId | UNIQUEIDENTIFIER | FK (existing) | |
| ActorUserId | NVARCHAR(255) | NOT NULL (existing) | |
| ChangeScope | NVARCHAR(32) | NOT NULL (existing) | 'Numerator', 'Denominator', 'Adoption' |
| PreviousRulesJson | NVARCHAR(MAX) | NULL (existing) | |
| NewRulesJson | NVARCHAR(MAX) | NOT NULL (existing) | |
| ChangedAt | DATETIME2 | NOT NULL (existing) | |
| **ChangeType** | **NVARCHAR(32)** | **NOT NULL, DEFAULT 'Update'** | **NEW — 'Update' or 'ForceOverride'** |
| **OverrideReason** | **NVARCHAR(500)** | **NULL** | **NEW — Required when ChangeType = 'ForceOverride'** |

**TypeScript Update**:
```typescript
// Extend existing DenominatorAuditHistoryEntry
export interface DenominatorAuditHistoryEntry {
  auditId: string;
  applicationId: string;
  actorUserId: string;
  changeScope: 'Denominator' | 'Numerator' | 'Adoption';
  previousRulesJson: string | null;
  newRulesJson: string;
  changedAt: string;
  changeType: 'Update' | 'ForceOverride';       // NEW
  overrideReason: string | null;                  // NEW
}
```

**Validation Rules**:
- `ChangeType` constrained via CHECK: `IN ('Update', 'ForceOverride')`
- `OverrideReason` MUST be non-null when `ChangeType = 'ForceOverride'` (enforced at API layer)
- Existing rows default to `ChangeType = 'Update'`, `OverrideReason = NULL`

---

### DenominatorFilterRuleset (Extended Response)

No schema change — response payload extended to include concurrency metadata.

**TypeScript Update** (response envelope):
```typescript
export interface DenominatorFilterRulesetResponse {
  applicationId: string;
  applicationName: string;
  rules: DenominatorFilterRule[];
  lastUpdatedAt: string | null;
  lastUpdatedBy: string | null;
  configVersion: number;                 // NEW — from ConfigVersions table
  activeEditors: ActiveEditor[];         // NEW — from ConfigEditSessions table
}
```

---

### ParsedNumerator (Temp Table — Extended)

The `#ParsedNumerator` temp table in `usp_ExecutePipelineRun` is extended with composite key columns.

| Field | Type | Notes |
|-------|------|-------|
| ResultId | UNIQUEIDENTIFIER | Existing |
| StageId | (existing) | Existing |
| ItemIndex | INT | Existing |
| ItemJson | NVARCHAR(MAX) | Existing |
| RecordKey | NVARCHAR(256) | Existing — adoption-level key (for Step 5 matching) |
| **ClientId** | **NVARCHAR(256)** | **NEW — extracted from JSON for dedup** |
| **EngagementId** | **NVARCHAR(256)** | **NEW — extracted from JSON for dedup** |
| DuplicateRank | INT | Existing — now partitioned by `(ClientId, EngagementId)` |

**State Transitions** (dedup logic change):
```
Before: PARTITION BY RecordKey (single key based on AdoptionLevel)
After:  PARTITION BY ClientId, EngagementId (always composite)

Records where ClientId IS NULL OR EngagementId IS NULL → flagged Invalid (skip dedup)
Records with DuplicateRank > 1 → flagged as Duplicate
Records with DuplicateRank = 1 → proceed to validation
```

---

## Relationships

```
app.Applications (1) ←→ (0..N) app.ConfigVersions
app.Applications (1) ←→ (0..N) app.ConfigEditSessions
app.Applications (1) ←→ (0..N) app.RuleChangeAudit
app.Applications (1) ←→ (0..N) app.DenominatorFilterRules
app.Applications (1) ←→ (0..N) app.NumeratorFilterRules
app.Applications (1) ←→ (0..N) app.PipelineRuns
app.ConfigVersions (ApplicationId, RuleScope) ←→ optimistic guard on filter PUT endpoints
app.ConfigEditSessions (ApplicationId, RuleScope) ←→ advisory presence on filter GET endpoints
```

---

## Indexes

### ConfigVersions
- PK: `(ApplicationId, RuleScope)` — clustered

### ConfigEditSessions
- PK: `SessionId` — clustered
- IX: `(ApplicationId, RuleScope, IsActive)` — for querying active editors
- UQ (filtered): `(ApplicationId, RuleScope, UserId) WHERE IsActive = 1` — one session per user per scope

### RuleChangeAudit (existing index retained)
- IX: `(ApplicationId, ChangedAt DESC) INCLUDE (ActorUserId)` — existing
- IX: `(ApplicationId, ChangeType)` — new, for force-override audits

---

## Migration Scripts Summary

| # | Name | Action |
|---|------|--------|
| 031 | `031_create_stage_denominator_filter_rules_preview.sql` | CREATE TABLE `stage.DenominatorFilterRulesPreview` with indexes, FK to DenominatorModels, CHECK constraint on Operator |
| 032 | `032_create_config_versions.sql` | CREATE TABLE `app.ConfigVersions`; seed one row per (ApplicationId, Scope) for all 5 apps × 2 scopes |
| 033 | `033_create_config_edit_sessions.sql` | CREATE TABLE `app.ConfigEditSessions` with indexes |
| 034 | `034_alter_usp_execute_pipeline_run_preview_session.sql` | ALTER `usp_ExecutePipelineRun` — add `@previewSessionId UNIQUEIDENTIFIER = NULL`; pass through to `usp_BuildFilteredDenominator` |
| 035 | `035_alter_usp_build_filtered_denominator_preview.sql` | ALTER `usp_BuildFilteredDenominator` — add `@previewSessionId UNIQUEIDENTIFIER = NULL`; IF/ELSE branch for rule source |
| 036 | `036_alter_usp_execute_pipeline_run_composite_dedup.sql` | ALTER `usp_ExecutePipelineRun` Step 4 (parse/dedup) — change `PARTITION BY` to composite key; add NULL key validation |
| 037 | `037_alter_rule_change_audit_changetype.sql` | ALTER TABLE add `ChangeType`, `OverrideReason` columns; backfill existing rows with 'Update'; add CHECK constraint |

---

## Stored Procedure Changes

### usp_ExecutePipelineRun — Step 4 (Parse/Dedup)

**Before** (lines ~186-196):
```sql
CASE
    WHEN @isClientAdoption = 1 THEN JSON_VALUE(item.ItemJson, '$.clientId')
    ELSE JSON_VALUE(item.ItemJson, '$.engagementId')
END AS RecordKey,
ROW_NUMBER() OVER (
    PARTITION BY CASE
        WHEN @isClientAdoption = 1 THEN JSON_VALUE(item.ItemJson, '$.clientId')
        ELSE JSON_VALUE(item.ItemJson, '$.engagementId')
    END
    ORDER BY eur.StageId DESC, item.ItemIndex DESC
) AS DuplicateRank
```

**After**:
```sql
-- RecordKey remains adoption-level for Step 5 matching
CASE
    WHEN @isClientAdoption = 1 THEN JSON_VALUE(item.ItemJson, '$.clientId')
    ELSE JSON_VALUE(item.ItemJson, '$.engagementId')
END AS RecordKey,
-- NEW: Composite key fields for dedup
JSON_VALUE(item.ItemJson, '$.clientId') AS ClientId,
JSON_VALUE(item.ItemJson, '$.engagementId') AS EngagementId,
-- Dedup uses composite key (always both fields)
ROW_NUMBER() OVER (
    PARTITION BY
        JSON_VALUE(item.ItemJson, '$.clientId'),
        JSON_VALUE(item.ItemJson, '$.engagementId')
    ORDER BY eur.StageId DESC, item.ItemIndex DESC
) AS DuplicateRank
```

**Validation enhancement** (after dedup, before Step 5):
```sql
-- Records with NULL composite keys → Invalid (not duplicate)
CASE
    WHEN ClientId IS NULL OR LTRIM(RTRIM(ClientId)) = ''
         OR EngagementId IS NULL OR LTRIM(RTRIM(EngagementId)) = ''
    THEN 'Invalid'
    WHEN DuplicateRank > 1
    THEN 'Duplicate'
    ...
END
```
