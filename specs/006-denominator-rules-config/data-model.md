# Data Model: EPIC-008 Denominator Rules Configuration

**Status**: Design - Phase 1  
**Date**: 2026-04-15  
**Branch**: `006-denominator-rules-config`

## Entity Relationship Diagram

```text
┌─────────────────────┐
│   Applications      │
│ (existing, app)     │
└─────────┬───────────┘
          │ 1
          │
          ├──────────────────────────────────────────────────┐
          │ N                                                │ 1
┌─────────▼───────────┐     N     ┌──────────────────────┐   │
│ DenominatorFilter   │ ────────► │  DenominatorModels   │   │
│ Rules (per-app)     │   FK      │  (shared, no AppId)  │   │
└─────────────────────┘           └──────────────────────┘   │
          │                                                  │
          │ (audit via)                                      │
          ▼                                                  │
┌─────────────────────┐     ┌──────────────────────┐         │
│  RuleChangeAudit    │     │  AdoptionSettings     │◄───────┘
│  (shared, +scope)   │     │  (per-app, 1:1)       │
└─────────────────────┘     └───────────────────────┘
```

## Domain Entities

### DenominatorModels (NEW — shared)

Defines the Mercury view column schema. One row per column (~17 rows total). **No ApplicationId** — shared across all applications.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `DenominatorModelId` | UNIQUEIDENTIFIER | PK, DEFAULT NEWID() | Primary key |
| `FieldName` | NVARCHAR(128) | NOT NULL, UNIQUE | Logical field name (e.g., `EngagementServiceCode`) |
| `FieldType` | NVARCHAR(32) | NOT NULL, CHECK IN ('text','numeric','date') | Data type |
| `SourceColumn` | NVARCHAR(256) | NOT NULL | Actual Mercury view column name (e.g., `[EngagementServiceCode]`) |
| `IsFilterable` | BIT | NOT NULL, DEFAULT 1 | Whether field can be used in filter rules |
| `DisplayOrder` | INT | NOT NULL | UI display ordering |
| `IsActive` | BIT | NOT NULL, DEFAULT 1 | Soft delete flag |
| `CreateDate` | DATETIME2 | NOT NULL, DEFAULT SYSUTCDATETIME() | Audit |
| `CreatedBy` | NVARCHAR(255) | NOT NULL, DEFAULT SUSER_SNAME() | Audit |
| `UpdateDate` | DATETIME2 | NOT NULL, DEFAULT SYSUTCDATETIME() | Audit |
| `UpdatedBy` | NVARCHAR(255) | NOT NULL, DEFAULT SUSER_SNAME() | Audit |

**Seed data** (17 rows):

| FieldName | FieldType | SourceColumn | IsFilterable | DisplayOrder |
|-----------|-----------|--------------|-------------|-------------|
| EngagementID | text | `[EngagementID]` | 0 | 1 |
| Engagement | text | `[Engagement]` | 1 | 2 |
| ClientID | text | `[ClientID]` | 0 | 3 |
| Client | text | `[Client]` | 1 | 4 |
| AccountChannel | text | `[AccountChannel]` | 1 | 5 |
| EngagementSubServiceLine | text | `[EngagementSubServiceLine]` | 1 | 6 |
| EngagementServiceCode | text | `[EngagementServiceCode]` | 1 | 7 |
| EngagementService | text | `[EngagementService]` | 0 | 8 |
| EngagementStatus | text | `[EngagementStatus]` | 1 | 9 |
| CreationDate | date | `[CreationDate]` | 1 | 10 |
| ReleaseDate | date | `[ReleaseDate]` | 1 | 11 |
| ETD_ANSRAmt | numeric | `[ETD_ANSRAmt]` | 1 | 12 |
| FYTD_ANSRAmt | numeric | `[FYTD_ANSRAmt]` | 1 | 13 |
| ETD_TERAmt | numeric | `[ETD_TERAmt]` | 1 | 14 |
| FYTD_TERAmt | numeric | `[FYTD_TERAmt]` | 1 | 15 |
| ETD_ChargedHours | numeric | `[ETD_ChargedHours]` | 0 | 16 |
| FYTD_ChargedHours | numeric | `[FYTD_ChargedHours]` | 0 | 17 |

**Summary**: 17 fields total, 12 filterable, 5 non-filterable (IDs + display-only fields).

---


### DenominatorFilterRules (NEW — per-app)

Per-application filter rules referencing `DenominatorModels` fields.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `RuleId` | UNIQUEIDENTIFIER | PK, DEFAULT NEWID() | Primary key |
| `ApplicationId` | UNIQUEIDENTIFIER | NOT NULL, FK → Applications | Rules are per-app |
| `DenominatorModelId` | UNIQUEIDENTIFIER | NOT NULL, FK → DenominatorModels | References a Mercury column |
| `Operator` | NVARCHAR(32) | NOT NULL, CHECK IN ('EQUALS','NOT_EQUALS','CONTAINS','NOT_CONTAINS','IN_LIST','NOT_IN_LIST','GREATER_THAN','GREATER_OR_EQUAL','LESS_THAN','LESS_OR_EQUAL') | Canonical comparison operator |
| `Value` | NVARCHAR(512) | NOT NULL | Filter value |
| `RuleOrder` | INT | NOT NULL, CHECK (`RuleOrder` >= 1) | Execution order within one application |
| `IsActive` | BIT | NOT NULL, DEFAULT 1 | Soft delete flag |
| `CreateDate` | DATETIME2 | NOT NULL, DEFAULT SYSUTCDATETIME() | Audit |
| `CreatedBy` | NVARCHAR(255) | NOT NULL, DEFAULT SUSER_SNAME() | Audit |
| `UpdateDate` | DATETIME2 | NOT NULL, DEFAULT SYSUTCDATETIME() | Audit |
| `UpdatedBy` | NVARCHAR(255) | NOT NULL, DEFAULT SUSER_SNAME() | Audit |

**Active-row constraints**:

- Unique filtered index on `(ApplicationId, DenominatorModelId, Operator, Value)` where `IsActive = 1` — prevents exact duplicate active rules.
- Unique filtered index on `(ApplicationId, RuleOrder)` where `IsActive = 1` — preserves deterministic ordering for the active rule set.
- Service-layer validation restricts operators by `FieldType`; the database `CHECK` constraint only enforces the allowed canonical operator vocabulary.

---


### AdoptionSettings (NEW — per-app, 1:1)

Per-application adoption configuration. One row per application.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `SettingId` | UNIQUEIDENTIFIER | PK, DEFAULT NEWID() | Primary key |
| `ApplicationId` | UNIQUEIDENTIFIER | NOT NULL, FK → Applications, UNIQUE | One per app |
| `AdoptionLevel` | NVARCHAR(32) | NOT NULL, CHECK IN ('engagement','client') | Match key type |
| `RevenueMetric` | NVARCHAR(64) | NOT NULL | Must reference an active numeric `DenominatorModels.FieldName` |
| `NumeratorSource` | NVARCHAR(32) | NOT NULL, CHECK IN ('API','Manual') | Data source type |
| `CreateDate` | DATETIME2 | NOT NULL, DEFAULT SYSUTCDATETIME() | Audit |
| `CreatedBy` | NVARCHAR(255) | NOT NULL, DEFAULT SUSER_SNAME() | Audit |
| `UpdateDate` | DATETIME2 | NOT NULL, DEFAULT SYSUTCDATETIME() | Audit |
| `UpdatedBy` | NVARCHAR(255) | NOT NULL, DEFAULT SUSER_SNAME() | Audit |

**Seed data** (5 rows):

| Application | AdoptionLevel | RevenueMetric | NumeratorSource |
|-------------|--------------|---------------|-----------------|
| Maestro | engagement | ETD_ANSRAmt | API |
| EYST | client | ETD_ANSRAmt | API |
| Prodigy | client | ETD_ANSRAmt | API |
| Vector | engagement | ETD_ANSRAmt | API |
| Navigate | engagement | FYTD_ANSRAmt | API |

---
### DenominatorImpactPreview

Transient, non-persistent result for proposed rule evaluation.

| Field | Type | Required | Notes |
|---|---|---|---|
| ApplicationId | UUID | Yes | Scope |
| CurrentCount | integer | Yes | Active config result |
| ProjectedCount | integer | Yes | Proposed config result |
| CurrentRevenue | decimal | Yes | Active config revenue |
| ProjectedRevenue | decimal | Yes | Proposed config revenue |
| DeltaCount | integer | Yes | Projected - Current |
| DeltaRevenue | decimal | Yes | Projected - Current |
| CalculatedAtUtc | datetime | Yes | Preview timestamp |

### RuleChangeAuditEntry

Immutable audit record for successful denominator config mutations. Existing table with new column.

| Field | Type | Required | Notes |
|---|---|---|---|
| AuditId | UUID | Yes | Identity |
| ApplicationId | UUID | Yes | Scope |
| ActorUserId | string | Yes | Actor identity |
| PreviousRulesJson | json/string | Yes | Snapshot before mutation |
| NewRulesJson | json/string | Yes | Snapshot after mutation |
| ChangeScope | enum(Numerator,Denominator,Adoption) | Yes | Change classification |
| ChangedAt | datetime | Yes | Event time |

## Relationship Rules

1. One `Application` has many active/inactive `DenominatorFilterRule` rows.
2. One `DenominatorFilterRule` references exactly one `DenominatorModel`.
3. One `Application` has exactly one `AdoptionSetting` row.
4. One successful denominator rules replacement creates one `RuleChangeAuditEntry`; one successful adoption-settings update creates one `RuleChangeAuditEntry`.
5. `DenominatorImpactPreview` is computed from proposed rules + current active rules; it is not persisted as a durable entity.

## Validation Rules

1. Rule operators must be valid for the selected field type using canonical operator labels.
2. Rule values must satisfy type constraints for `text`, `numeric`, and `date` fields; denominator fields do not use `boolean`.
3. Duplicate active rules (same app + field + operator + value) are rejected.
4. Rule order must be unique within active rules for one application.
5. Rules may only reference active denominator model rows marked `IsFilterable = 1`.
6. `RevenueMetric` must reference an active numeric denominator model field.
7. All rule reads/writes must be authorization-scoped to role + assignment context.


### Operator-FieldType Matrix

| FieldType | Allowed Operators |
|-----------|-------------------|
| `text` | EQUALS, NOT_EQUALS, IN_LIST, NOT_IN_LIST, CONTAINS, NOT_CONTAINS |
| `numeric` | EQUALS, NOT_EQUALS, GREATER_THAN, GREATER_OR_EQUAL, LESS_THAN, LESS_OR_EQUAL |
| `date` | EQUALS, GREATER_THAN, GREATER_OR_EQUAL, LESS_THAN, LESS_OR_EQUAL |

### Value Validation by FieldType

| FieldType | Validation |
|-----------|------------|
| `text` | Non-empty, max 512 chars. For `IN_LIST`/`NOT_IN_LIST`: semicolon-separated non-empty values. |
| `numeric` | Must parse as a valid numeric string. Non-negative values only. |
| `date` | Must parse as valid ISO date string. |

---

## TypeScript Type Definitions

### DenominatorModelRow

```typescript
type DenominatorModelRow = {
  DenominatorModelId: string;
  FieldName: string;
  FieldType: 'text' | 'numeric' | 'date';
  SourceColumn: string;
  IsFilterable: boolean;
  DisplayOrder: number;
  IsActive: boolean;
};
```

### DenominatorFilterRuleRow

```typescript
type DenominatorFilterRuleRow = {
  RuleId: string;
  ApplicationId: string;
  DenominatorModelId: string;
  FieldName: string;    // Resolved from JOIN with DenominatorModels
  FieldType: 'text' | 'numeric' | 'date';
  SourceColumn: string; // Resolved from JOIN with DenominatorModels
  Operator:
    | 'EQUALS'
    | 'NOT_EQUALS'
    | 'CONTAINS'
    | 'NOT_CONTAINS'
    | 'IN_LIST'
    | 'NOT_IN_LIST'
    | 'GREATER_THAN'
    | 'GREATER_OR_EQUAL'
    | 'LESS_THAN'
    | 'LESS_OR_EQUAL';
  Value: string;
  RuleOrder: number;
  IsActive: boolean;
  CreateDate: Date;
  CreatedBy: string;
  UpdateDate: Date;
  UpdatedBy: string;
};
```

### DenominatorRuleInput

```typescript
type DenominatorRuleInput = {
  denominatorModelId: string;
  operator:
    | 'EQUALS'
    | 'NOT_EQUALS'
    | 'CONTAINS'
    | 'NOT_CONTAINS'
    | 'IN_LIST'
    | 'NOT_IN_LIST'
    | 'GREATER_THAN'
    | 'GREATER_OR_EQUAL'
    | 'LESS_THAN'
    | 'LESS_OR_EQUAL';
  value: string;
};
```

### AdoptionSettingsRow

```typescript
type AdoptionSettingsRow = {
  SettingId: string;
  ApplicationId: string;
  AdoptionLevel: 'engagement' | 'client';
  RevenueMetric: string;
  NumeratorSource: 'API' | 'Manual';
  CreateDate: Date;
  CreatedBy: string;
  UpdateDate: Date;
  UpdatedBy: string;
};
```

### AdoptionSettingsInput

```typescript
type AdoptionSettingsInput = {
  adoptionLevel: 'engagement' | 'client';
  revenueMetric: string;
  numeratorSource: 'API' | 'Manual';
};
```

### DenominatorPreviewResult

```typescript
type DenominatorPreviewResult = {
  applicationId: string;
  current: {
    count: number;
    revenue: number;
  };
  projected: {
    count: number;
    revenue: number;
  };
  delta: {
    count: number;
    revenue: number;
  };
  calculatedAtUtc: Date;
};
```

### AuditEntry (extended)

```typescript
type AuditEntry = {
  AuditId: string;
  ApplicationId: string;
  ActorUserId: string;
  ChangeScope: 'Numerator' | 'Denominator' | 'Adoption';
  PreviousRulesJson: string;
  NewRulesJson: string;
  ChangedAt: Date;
};
```
---

## State Transitions

### Rule Set

- `current` -> `previewed` when proposed changes are evaluated.
- `previewed` -> `saved` only after explicit save by authorized user.
- `previewed` -> `discarded` when user cancels.
- `current` remains unchanged on validation/auth failures.

### Rule Rows

- `active` -> `inactive` on successful full replacement transaction.
- New replacement rows are inserted as `active`.
