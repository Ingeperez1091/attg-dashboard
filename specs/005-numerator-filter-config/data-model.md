# Data Model: Epic 004 — Numerator Filter Configuration

**Status**: Design — Phase 1  
**Date**: May 4, 2026  
**Branch**: `005-numerator-filter-config`

---

## Domain Model

### Core Entities

#### ApplicationModelField

Metadata declaration of a single field in an application's numerator payload structure.

**SQL Table**: `app.ApplicationModelFields`

| Column | Type | Nullable | Constraints | Notes |
|--------|------|----------|-------------|-------|
| ApplicationModelFieldId | UNIQUEIDENTIFIER | NO | PK | Surrogate key |
| ApplicationId | UNIQUEIDENTIFIER | NO | FK (app.Applications) | Links to application |
| FieldName | VARCHAR(128) | NO | | e.g., "NavigateStatus", "RevenueFYTD" |
| FieldType | VARCHAR(20) | NO | CHECK (FieldType IN ('text','numeric','boolean','date')) | Determines valid operators |
| SourcePath | VARCHAR(512) | NO | | JSON path in numerator payload, e.g., "$.status" |
| IsActive | BIT | NO | DEFAULT 1 | Controls whether field definition is active |
| IsFilterable | BIT | NO | DEFAULT 1 | All active fields are returned to UI; non-filterable fields are shown disabled |
| IsMetricDimension | BIT | NO | DEFAULT 0 | Field contributes to aggregation dimensions |
| DisplayOrder | INT | NO | DEFAULT 0 | UI sort order (ascending) |
| CreateDate | DATETIME2 | NO | DEFAULT SYSUTCDATETIME() | Audit |
| CreatedBy | NVARCHAR(255) | NO | DEFAULT SUSER_SNAME() | Audit |
| UpdateDate | DATETIME2 | NO | DEFAULT SYSUTCDATETIME() | Audit |
| UpdatedBy | NVARCHAR(255) | NO | DEFAULT SUSER_SNAME() | Audit |

**Indexes**:
- Clustered: (ApplicationId, DisplayOrder)
- Non-clustered: (ApplicationId, IsFilterable) — for UI field selector filtering

##### Constraints

- `PK_ApplicationModelFields` on `ApplicationModelFieldId`.
- `FK_ApplicationModelFields_Applications` on `ApplicationId` → `app.Applications(ApplicationId)`.
- `UQ_ApplicationModelFields_AppField` on (`ApplicationId`, `FieldName`) — prevents duplicate field names per application.
- `FieldType` CHECK constraint: value must be one of `text`, `numeric`, `boolean`, `date`.

##### Validation Rules

- `ApplicationId` must reference an active application in `app.Applications`.
- `FieldName` must be non-empty and unique within the same application.
- `FieldType` must be one of the four allowed types.
- `IsActive` controls field lifecycle; only active rows participate in retrieval and validation.
- Exactly one active field per `ApplicationId` must have `IsMetricDimension = 1`.
- `DisplayOrder` must be a non-negative integer, unique per application.


**Sample Data** (Navigate application):
| ApplicationModelFieldId | ApplicationId | FieldName | FieldType | SourcePath | IsActive | IsFilterable | DisplayOrder |
|---|---|---|---|---|---|---|---|
| 20000000-0000-0000-0000-000000000101 | 10000000-0000-0000-0000-000000000005 | RevenueFYTD | numeric | $.revenueFYTD | 1 | 1 | 1 |
| 20000000-0000-0000-0000-000000000102 | 10000000-0000-0000-0000-000000000005 | NavigateStatus | text | $.status | 1 | 1 | 2 |
| 20000000-0000-0000-0000-000000000103 | 10000000-0000-0000-0000-000000000005 | EngagementId | text | $.id | 1 | 0 | 3 |

##### Seed Data — Per-Application Numerator Model Definitions

Seeded via migration `009_seed_application_model_fields.sql` using MERGE (idempotent). Field definitions are derived from the **Payload Template by Application** in [AUTOMATED_SOLUTION_ARCHITECTURE.md](../../Documentation/StakeholderDocuments/AUTOMATED_SOLUTION_ARCHITECTURE.md) and the business rules in [BUSINESS_RULES_AND_ETL_SUMMARY.md](../../Documentation/StakeholderDocuments/BUSINESS_RULES_AND_ETL_SUMMARY.md). **32 total rows** across 5 applications.

ApplicationModelFieldId values follow the convention `40000000-0000-0000-AABB-00000000CCCC` where `AA` = application ordinal (01–05), `BB` = field ordinal (01–nn), `CCCC` = zero-padded.

---

###### Maestro (5 fields) — Engagement-level, Auto-generated numerator

ApplicationId: `10000000-0000-0000-0000-000000000001`

| # | ApplicationModelFieldId | FieldName | FieldType | SourcePath | IsFilterable | IsMetricDimension | DisplayOrder |
|---|-------------------|-----------|-----------|------------|:------------:|:-----------------:|:------------:|
| 1 | `40000000-0000-0000-0101-000000000001` | EngagementId | text | `$.engagementId` | 0 | 0 | 1 |
| 2 | `40000000-0000-0000-0102-000000000001` | ClientId | text | `$.clientId` | 1 | 0 | 2 |
| 3 | `40000000-0000-0000-0103-000000000001` | ClientName | text | `$.clientName` | 0 | 0 | 3 |
| 4 | `40000000-0000-0000-0104-000000000001` | EngagementName | text | `$.engagementName` | 0 | 0 | 4 |
| 5 | `40000000-0000-0000-0105-000000000001` | InMaestro | boolean | `$.inMaestro` | 1 | 1 | 5 |

**Filterable fields**: ClientId (text), InMaestro (boolean)
**Classification**: Presence in dataset = "In Maestro". `InMaestro` boolean sourced from Maestro system export.
**Business context**: 25+ monthly Excel files consolidated; old format (ClientCode/EyEngagementId) and new format (Client Id/Engagement Id) both supported.

---

###### EYST (7 fields) — Client-level, API numerator

ApplicationId: `10000000-0000-0000-0000-000000000002`

| # | ApplicationModelFieldId | FieldName | FieldType | SourcePath | IsFilterable | IsMetricDimension | DisplayOrder |
|---|-------------------|-----------|-----------|------------|:------------:|:-----------------:|:------------:|
| 1 | `40000000-0000-0000-0201-000000000002` | ClientId | text | `$.clientId` | 0 | 0 | 1 |
| 2 | `40000000-0000-0000-0202-000000000002` | ClientName | text | `$.clientName` | 0 | 0 | 2 |
| 3 | `40000000-0000-0000-0203-000000000002` | EngagementCount | numeric | `$.engagementCount` | 1 | 0 | 3 |
| 4 | `40000000-0000-0000-0204-000000000002` | TotalRevenueETD | numeric | `$.totalRevenueETD` | 1 | 1 | 4 |
| 5 | `40000000-0000-0000-0205-000000000002` | EYSTActive | text | `$.eystActive` | 1 | 0 | 5 |
| 6 | `40000000-0000-0000-0206-000000000002` | EYSTDataCleanupActive | text | `$.eystDataCleanupActive` | 1 | 0 | 6 |
| 7 | `40000000-0000-0000-0207-000000000002` | Notes | text | `$.notes` | 0 | 0 | 7 |

**Filterable fields**: EngagementCount (numeric), TotalRevenueETD (numeric), EYSTActive (text), EYSTDataCleanupActive (text)
**Valid values**: `EYSTActive` → `Yes` | `No`; `EYSTDataCleanupActive` → `Yes` | `No`
**Match key**: Client ID
**Business context**: FTTS service codes 10459, 11420, 10170, 10466. Engagement name must contain `FTTS`. Source is ShareTrust export with `EYST Active Client` and `EYST Data Clean-Up Active Client` roll-up columns.

---

###### Prodigy (7 fields) — Client-level, Auto-generated + Override

ApplicationId: `10000000-0000-0000-0000-000000000003`

| # | ApplicationModelFieldId | FieldName | FieldType | SourcePath | IsFilterable | IsMetricDimension | DisplayOrder |
|---|-------------------|-----------|-----------|------------|:------------:|:-----------------:|:------------:|
| 1 | `40000000-0000-0000-0301-000000000003` | ClientId | text | `$.clientId` | 0 | 0 | 1 |
| 2 | `40000000-0000-0000-0302-000000000003` | ClientName | text | `$.clientName` | 0 | 0 | 2 |
| 3 | `40000000-0000-0000-0303-000000000003` | EngagementCount | numeric | `$.engagementCount` | 1 | 0 | 3 |
| 4 | `40000000-0000-0000-0304-000000000003` | TotalRevenueFYTD | numeric | `$.totalRevenueFYTD` | 1 | 1 | 4 |
| 5 | `40000000-0000-0000-0305-000000000003` | InProdigy | text | `$.inProdigy` | 0 | 0 | 5 |
| 6 | `40000000-0000-0000-0306-000000000003` | Override | text | `$.override` | 1 | 0 | 6 |
| 7 | `40000000-0000-0000-0307-000000000003` | Notes | text | `$.notes` | 0 | 0 | 7 |

**Filterable fields**: EngagementCount (numeric), TotalRevenueFYTD (numeric), Override (text)
**Note**: `InProdigy` is **not filterable** (auto-populated from Prodigy system, display-only). `Override` allows manual correction when system data is stale.
**Match key**: Client ID
**Business context**: R&D service code 10676. Match by Client ID (not Engagement ID). 1,382 engagements across 798 unique clients typical.

---

###### Vector (6 fields) — Engagement-level, API numerator

ApplicationId: `10000000-0000-0000-0000-000000000004`

| # | ApplicationModelFieldId | FieldName | FieldType | SourcePath | IsFilterable | IsMetricDimension | DisplayOrder |
|---|-------------------|-----------|-----------|------------|:------------:|:-----------------:|:------------:|
| 1 | `40000000-0000-0000-0401-000000000004` | EngagementId | text | `$.engagementId` | 0 | 0 | 1 |
| 2 | `40000000-0000-0000-0402-000000000004` | ClientId | text | `$.clientId` | 1 | 0 | 2 |
| 3 | `40000000-0000-0000-0403-000000000004` | ClientName | text | `$.clientName` | 0 | 0 | 3 |
| 4 | `40000000-0000-0000-0404-000000000004` | RevenueFYTD | numeric | `$.revenueFYTD` | 1 | 0 | 4 |
| 5 | `40000000-0000-0000-0405-000000000004` | RevenueETD | numeric | `$.revenueETD` | 1 | 1 | 5 |
| 6 | `40000000-0000-0000-0406-000000000004` | VectorEngagement | text | `$.vectorEngagement` | 1 | 0 | 6 |

**Filterable fields**: ClientId (text), RevenueFYTD (numeric), RevenueETD (numeric), VectorEngagement (text)
**Valid values**: `VectorEngagement` → `Yes` | `No`
**Match key**: Engagement ID
**Business context**: Service codes 10675, 10677. Account Channel 2 only. Minimum revenue ETD > $10,000. Data enrichment merges Vector engagement list with Mercury on Engagement ID to add revenue columns.

---

###### Navigate (7 fields) — Engagement-level, API numerator

ApplicationId: `10000000-0000-0000-0000-000000000005`

| # | ApplicationModelFieldId | FieldName | FieldType | SourcePath | IsFilterable | IsMetricDimension | DisplayOrder |
|---|-------------------|-----------|-----------|------------|:------------:|:-----------------:|:------------:|
| 1 | `40000000-0000-0000-0501-000000000005` | EngagementId | text | `$.engagementId` | 0 | 0 | 1 |
| 2 | `40000000-0000-0000-0502-000000000005` | ClientId | text | `$.clientId` | 0 | 0 | 2 |
| 3 | `40000000-0000-0000-0503-000000000005` | ClientName | text | `$.clientName` | 0 | 0 | 3 |
| 4 | `40000000-0000-0000-0504-000000000005` | EngagementName | text | `$.engagementName` | 0 | 0 | 4 |
| 5 | `40000000-0000-0000-0505-000000000005` | RevenueFYTD | numeric | `$.revenueFYTD` | 1 | 1 | 5 |
| 6 | `40000000-0000-0000-0506-000000000005` | NavigateStatus | text | `$.navigateStatus` | 1 | 0 | 6 |
| 7 | `40000000-0000-0000-0507-000000000005` | Notes | text | `$.notes` | 0 | 0 | 7 |

**Filterable fields**: RevenueFYTD (numeric), NavigateStatus (text)
**Valid values**: `NavigateStatus` → `Navigate` | `Non-Navigate` | `Inactive` | `Not Classified`
**Match key**: Engagement ID
**Business context**: Service code 10469. Classification derived from multi-tab worksheet (New Navigate/Old Navigate → Navigate, New Non-Nav/Old Non-Nav → Non-Navigate, New Inactives/Old Inactives → Inactive). Forward-fill on Client names for grouped rows.

---

###### Summary Statistics

| Application | Total Fields | Filterable | Metric Dimensions | Adoption Level | Match Key |
|-------------|:-----------:|:----------:|:-----------------:|:--------------:|:---------:|
| Maestro | 5 | 2 | 1 | Engagement | Engagement ID |
| EYST | 7 | 4 | 1 | Client | Client ID |
| Prodigy | 7 | 3 | 1 | Client | Client ID |
| Vector | 6 | 4 | 1 | Engagement | Engagement ID |
| Navigate | 7 | 2 | 1 | Engagement | Engagement ID |
| **Total** | **32** | **15** | **5** | — | — |

---

---

#### NumeratorFilterRule

Represents one operator-value expression belonging to one application ruleset. References a field from the application's model metadata.

**SQL Table**: `app.NumeratorFilterRules`

| Column | Type | Nullable | Constraints | Notes |
|--------|------|----------|-------------|-------|
| RuleId | UNIQUEIDENTIFIER | NO | PK | Surrogate key |
| ApplicationId | UNIQUEIDENTIFIER | NO | FK (app.Applications) | Scopes rule to application |
| ApplicationModelFieldId | UNIQUEIDENTIFIER | NO | FK (app.ApplicationModelFields) | Referential integrity: field must exist and be filterable |
| Operator | VARCHAR(20) | NO | CHECK (Operator IN ('EQUALS','NOT_EQUALS','CONTAINS','NOT_CONTAINS','IN_LIST','NOT_IN_LIST','GREATER_THAN','GREATER_OR_EQUAL','LESS_THAN','LESS_OR_EQUAL')) | Type-validated via domain layer |
| Value | VARCHAR(512) | NO | | Filter value; format depends on FieldType |
| RuleOrder | INT | NO | | Sequence for AND-combination (1-based); unique per app |
| IsActive | BIT | NO | DEFAULT 1 | Soft-delete flag; active rules are returned by GET |
| CreateDate | DATETIME2 | NO | DEFAULT SYSUTCDATETIME() | Audit |
| CreatedBy | NVARCHAR(255) | NO | DEFAULT SUSER_SNAME() | Audit |
| UpdateDate | DATETIME2 | NO | DEFAULT SYSUTCDATETIME() | Audit |
| UpdatedBy | NVARCHAR(255) | NO | DEFAULT SUSER_SNAME() | Audit |

**Constraints**:
- (ApplicationId, RuleOrder) UNIQUE — enforces unique ordering per app
- Cascading delete prohibited on ApplicationId to prevent accidental rule loss

**Indexes**:
- Clustered: (ApplicationId, RuleOrder)
- Non-clustered: (ApplicationModelFieldId) — for referential integrity checks

##### Validation Rules

- `ApplicationId` must reference an active application.
- `ApplicationModelFieldId` must reference a field in `app.ApplicationModelFields` where `IsFilterable = 1` and `ApplicationId` matches the rule's `ApplicationId` (cross-application field leakage prevention).
- Incoming create/update rules that reference `IsFilterable = 0` fields are rejected with validation error `400 FIELD_NOT_FILTERABLE` and are not persisted.
- `Operator` must be valid for the referenced field's `FieldType`:
  - `text` → `EQUALS`, `NOT_EQUALS`, `CONTAINS`, `NOT_CONTAINS`, `IN_LIST`, `NOT_IN_LIST`
  - `numeric` → `EQUALS`, `NOT_EQUALS`, `GREATER_THAN`, `GREATER_OR_EQUAL`, `LESS_THAN`, `LESS_OR_EQUAL`
  - `boolean` → `EQUALS`
  - `date` → `EQUALS`, `GREATER_THAN`, `GREATER_OR_EQUAL`, `LESS_THAN`, `LESS_OR_EQUAL`
- `Value` cannot be null; list operators (`IN_LIST`, `NOT_IN_LIST`) require parseable multi-value content.
- `RuleOrder` must be unique per active (`IsActive = 1`) application ruleset.

##### State Transitions

- `draft request` → `rejected` on auth/validation failure (no mutation).
- `draft request` → `active ruleset` on successful transactional soft-replacement.
- `active rule` → `inactive` by soft-delete (`IsActive = 0`) during replacement/clear operations.


**Sample Data** (Navigate rules):
| RuleId | ApplicationId | ApplicationModelFieldId | Operator | Value | RuleOrder |
|---|---|---|---|---|---|
| 30000000-0000-0000-0000-000000000101 | 10000000-0000-0000-0000-000000000005 | 20000000-0000-0000-0000-000000000101 | GREATER_THAN | 50000 | 1 |
| 30000000-0000-0000-0000-000000000102 | 10000000-0000-0000-0000-000000000005 | 20000000-0000-0000-0000-000000000102 | EQUALS | Active | 2 |

---

#### RuleChangeAudit (Required, for Full Audit Trail)

Immutable log of rule set changes for compliance and debugging.

**SQL Table**: `app.RuleChangeAudit`

| Column | Type | Nullable | Constraints | Notes |
|--------|------|----------|-------------|-------|
| AuditId | UNIQUEIDENTIFIER | NO | PK | Surrogate key |
| ApplicationId | UNIQUEIDENTIFIER | NO | FK (app.Applications) | For filtering changes by application |
| PreviousRuleSet | NVARCHAR(MAX) | YES | | JSON snapshot of rules before change (NULL if first creation) |
| NewRuleSet | NVARCHAR(MAX) | NO | | JSON snapshot of rules after change |
| ChangedBy | NVARCHAR(255) | NO | DEFAULT SUSER_SNAME() | Actor who made the change |
| ChangeDate | DATETIME2 | NO | DEFAULT SYSUTCDATETIME() | When change was committed |

**Indexes**:
- Clustered: (ApplicationId, ChangeDate DESC) — for timeline queries

---

### Value Objects (Domain Layer)

Domain models use TypeScript-oriented field type labels (`string`, `number`, `boolean`, `date`). Persistence models store SQL enum-like values (`text`, `numeric`, `boolean`, `date`).

**Persistence -> Domain mapping**:
- `text` -> `string`
- `numeric` -> `number`
- `boolean` -> `boolean`
- `date` -> `date`

#### FieldOperator

Encapsulates operator validation logic; ensures operator is valid for the selected field type.

**Implementation** (`src/frontend/core/domain/valueobjects/FieldOperator.ts`):

```typescript
export type FieldType = 'string' | 'number' | 'boolean' | 'date';
export type TextOperator = 'EQUALS' | 'NOT_EQUALS' | 'CONTAINS' | 'NOT_CONTAINS' | 'IN_LIST' | 'NOT_IN_LIST';
export type NumericOperator = 'EQUALS' | 'NOT_EQUALS' | 'GREATER_THAN' | 'GREATER_OR_EQUAL' | 'LESS_THAN' | 'LESS_OR_EQUAL';
export type BooleanOperator = 'EQUALS';
export type DateOperator = 'EQUALS' | 'GREATER_THAN' | 'GREATER_OR_EQUAL' | 'LESS_THAN' | 'LESS_OR_EQUAL';

export class FieldOperator {
  private static readonly OPERATORS_BY_TYPE: Record<FieldType, string[]> = {
    'string': ['EQUALS', 'NOT_EQUALS', 'CONTAINS', 'NOT_CONTAINS', 'IN_LIST', 'NOT_IN_LIST'],
    'number': ['EQUALS', 'NOT_EQUALS', 'GREATER_THAN', 'GREATER_OR_EQUAL', 'LESS_THAN', 'LESS_OR_EQUAL'],
    'boolean': ['EQUALS'],
    'date': ['EQUALS', 'GREATER_THAN', 'GREATER_OR_EQUAL', 'LESS_THAN', 'LESS_OR_EQUAL'],
  };

  constructor(readonly fieldType: FieldType, readonly operator: string) {
    if (!this.isValid()) {
      throw new Error(`Operator '${operator}' not valid for field type '${fieldType}'`);
    }
  }

  private isValid(): boolean {
    return FieldOperator.OPERATORS_BY_TYPE[this.fieldType]?.includes(this.operator) ?? false;
  }

  static getValidOperators(fieldType: FieldType): string[] {
    return FieldOperator.OPERATORS_BY_TYPE[fieldType] ?? [];
  }
}
```

---

#### FilterRule

Encapsulates a single rule expression; validates operator + value combination.

**Implementation** (`src/frontend/core/domain/valueobjects/FilterRule.ts`):

```typescript
export interface FilterRuleProps {
  ruleId?: string;
  applicationModelFieldId: string;
  operator: string;
  value: string;
  ruleOrder: number;
}

export class FilterRule {
  readonly ruleId?: string;
  readonly applicationModelFieldId: string;
  readonly operator: string;
  readonly value: string;
  readonly ruleOrder: number;

  private static toDomainFieldType(fieldType: 'text' | 'numeric' | 'boolean' | 'date'): FieldType {
    if (fieldType === 'text') return 'string';
    if (fieldType === 'numeric') return 'number';
    return fieldType;
  }

  constructor(props: FilterRuleProps) {
    this.ruleId = props.ruleId;
    this.applicationModelFieldId = props.applicationModelFieldId;
    this.operator = props.operator;
    this.value = props.value;
    this.ruleOrder = props.ruleOrder;
  }

  // Validation delegated to domain service with FieldOperator + application model context
  static validateForApplicationModel(
    rule: FilterRule,
    applicationModelField: ApplicationModelField
  ): void {
    // Throws FilterValidationError if invalid
    const domainFieldType = FilterRule.toDomainFieldType(applicationModelField.fieldType);
    new FieldOperator(domainFieldType, rule.operator);
    // Additional value-format validation per type would occur here
  }
}
```

---

### Domain Services

#### FilterRuleValidator

Validates rule submissions against application model and authorization context.

**Responsibility**:
- Verify all rules reference valid ApplicationModelFields for the target application
- Verify operators are type-appropriate
- Verify values conform to field type (e.g., numeric value for numeric field)
- Ensure no referential integrity violations (e.g., field marked non-filterable)

---

### Repositories

#### INumeratorFilterRepository

Interface for filter rule persistence.

```typescript
export interface INumeratorFilterRepository {
  /**
   * Retrieve current filter rules for an application, ordered by RuleOrder.
   * @param applicationId Target application
   * @returns Ordered list of rules or empty array if none exist
   */
  getRulesForApplication(applicationId: string): Promise<FilterRule[]>;

  /**
   * Soft-replace entire active rule set for an application (atomic update).
   * @param applicationId Target application
   * @param newRules Validated, ordered rule list
  * @param changedBy Actor identifier for audit
   * @throws FilterValidationError if any rule invalid
   */
  updateRulesForApplication(
    applicationId: string,
    newRules: FilterRule[],
    changedBy: string
  ): Promise<void>;

  /**
   * Retrieve application model field definitions for filter UI.
   * @param applicationId Target application
   * @returns Fields marked as filterable=1
   */
  getFilterableFieldsForApplication(applicationId: string): Promise<ApplicationModelField[]>;
}
```

**Implementations**:
- `NumeratorFilterInMemoryRepository`: In-memory Map; used in contract/integration tests for deterministic isolation
- `NumeratorFilterSqlRepository`: Azure SQL via mssql driver; used in production and integration tests with real schema

---

### State Transitions

#### Rule Lifecycle

```
[Created] → [Active (Most Recent)] → [Archived (via audit log) when replaced]
     ↓
   Read-Only History (NumeratorFilterRuleChangeAudit)
```

- **Creation**: User submits new rule set via PUT endpoint → validated → stored in NumeratorFilterRules as active rows (`IsActive = 1`)
- **Update**: User modifies existing rule set → previously active rows soft-deleted (`IsActive = 0`) → new active rows inserted
- **Deletion/Clear**: PUT with empty rule set soft-deletes all previously active rows for that application (`IsActive = 0`)

---

### Authorization Context

Rules are scoped by:
1. **ApplicationId**: User can only access applications they are assigned to
2. **User Role**:
   - **administrator**: Read/write all apps' rules
   - **application_owner**: Read/write assigned apps' rules only
   - **viewer**: Read assigned apps' rules only

Authorization enforced in:
- Middleware layer: `filterAuthorizationMiddleware` checks role + assignment before route handler
- Repository layer: Repository methods receive authenticated ApplicationId; no filtering logic in repository
- Database layer: No direct DB access from outside repository; all queries parameterized

---

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────┐
│                  Applications                   │
│        (existing: app.Applications)             │
│  PK: ApplicationId                              │
│  Fields: Name, ServiceLine, IsActive            │
└──────────────────────┬──────────────────────────┘
                       │ 1
                       │
                  1:M  │
                       │
            ┌──────────┴────────────────────┐
            │                               │
            ▼                               ▼
┌─────────────────────────────┐   ┌─────────────────────────────────────────┐
│ ApplicationModelFields      │   │ NumeratorFilterRules                    │
│ PK: ApplicationModelFieldId │   │ PK: RuleId                              │
│ FK: ApplicationId (1:M)     │   │ FK: ApplicationId (1:M)                 │
│                             │   │ FK: ApplicationModelFieldId (1:M) ***   │
│ Fields:                     │   │                                         │
│  - FieldName                │   │ Fields:                                 │
│  - FieldType                │   │  - Operator                             │
│  - IsFilterable             │   │  - Value                                │
│  - DisplayOrder             │   │  - RuleOrder                            │
│  - Audit columns            │   │  - Audit columns                        │
└─────────────────────────────┘   └─────────────────────────────────────────┘
            ▲                           │
            │                           │
            │ (FK *** = referential)    │
            └───────────────────────────┘

Optional Audit Table:
┌───────────────────────────────────────────┐
│ NumeratorFilterRuleChangeAudit            │
│ PK: AuditId                               │
│ FK: ApplicationId                         │
│ Fields:                                   │
│  - PreviousRuleSet (JSON)                 │
│  - NewRuleSet (JSON)                      │
│  - ChangedBy (NVARCHAR(255) actor)         │
│  - ChangeDate                             │
└───────────────────────────────────────────┘
```

---

## Validation Rules

### Rule-Level Validation

1. **ApplicationModelFieldId must exist**: FK constraint at DB layer (UNIQUEIDENTIFIER)
2. **Field must be filterable**: Check `IsFilterable = 1` in ApplicationModelFields; if false, return `400 FIELD_NOT_FILTERABLE`
3. **Operator valid for field type**: Domain FieldOperator value object
4. **Value format correct for field type**:
   - **Numeric**: Parseable as INT or FLOAT
   - **Date**: Valid ISO 8601 format (YYYY-MM-DD)
   - **Text/Boolean**: Any string; no special format required
5. **RuleOrder unique per active application ruleset**: Unique on active rows only (ApplicationId, RuleOrder where IsActive = 1)

### Rule Set-Level Validation

1. **All rules must pass individual validation** (abort entire submission if any invalid)
2. **No duplicate rules** (same ApplicationModelFieldId + Operator + Value): Allowed but redundant; warn user
3. **Rule ordering must be contiguous 1..N**: Fill gaps if user submits {1,2,4}; warn of reordering
4. **Cross-app isolation**: All rules must reference ApplicationModelFieldId values (UNIQUEIDENTIFIER) belonging to the target ApplicationId

---

## Conclusion

This data model provides:
- ✅ Referential integrity between rules and model fields
- ✅ Type-safe operator validation via domain value objects  
- ✅ Per-application isolation with RBAC enforcement
- ✅ Audit trail via changelog table
- ✅ Indexed queries for <3s p95 latency
- ✅ Deterministic in-memory and SQL implementations for testing
