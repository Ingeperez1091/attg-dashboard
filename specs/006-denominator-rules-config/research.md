# Research & Clarification Resolution: EPIC-008 Denominator Rules Configuration

**Status**: COMPLETE  
**Date**: 2026-04-15  
**Branch**: `006-denominator-rules-config`

## Summary

Phase 0 research resolved all scope, architecture, and consistency decisions for denominator configuration, preview, and audit behavior. No unresolved NEEDS CLARIFICATION markers remain. Any remaining wording-level clarifications can be handled during task breakdown.

---

## Research Decisions

### R1 — Shared vs. Per-App Denominator Model

**Task**: Determine whether `DenominatorModels` should use a shared table (no `ApplicationId`) or per-app rows (like `ApplicationModels`).

**Decision**: Shared table — no `ApplicationId` column. Denominator field metadata is shared; rule sets and adoption settings are application-scoped.

**Rationale**: The Mercury view `[InventoryAnalysis].[dbo].[vw_USTaxBTS_FY26_MaxACD]` has a single fixed schema shared by all 5 applications. Defining columns once (17 rows) avoids duplication (vs. 85 rows per-app). Architecture Assumption A12 confirms this. Supports independent per-application criteria while avoiding duplicated schema metadata.

**Alternatives considered**:
- Per-app model (reuse `ApplicationModels` pattern): Rejected — would duplicate identical row definitions 5 times with no differentiation, and would semantically conflate numerator JSON payload fields with Mercury view columns.
- Add `ApplicationId` as nullable: Rejected — introduces ambiguity; either a row is shared or it is not.

---

### R2 — Operator Constraint Strategy

**Task**: Determine which operator labels to use and how to enforce type-aware operator validation for denominator filter rules (text, numeric, date fields).

**Decision**: Use the same operator labels as EPIC-005 numerator filter configuration: `EQUALS`, `NOT_EQUALS`, `CONTAINS`, `NOT_CONTAINS`, `IN_LIST`, `NOT_IN_LIST`, `GREATER_THAN`, `GREATER_OR_EQUAL`, `LESS_THAN`, `LESS_OR_EQUAL`. Reuse the `OPERATORS_BY_TYPE` constant from `core/domain/value-objects/FieldOperator.ts`. The denominator variant uses `text`, `numeric`, and `date` field types only (Mercury view has no boolean columns). Validation occurs in two layers:

1. **Zod schema** (`infrastructure/validation/denominatorFilterSchemas.ts`) — validates operator is in the full enum
2. **Service layer** — resolves the field's `FieldType` from `DenominatorModels` and validates the operator is in the allowed set for that type via `FieldOperator.validate()`

**Rationale**: Reusing existing operator labels prevents drift between numerator and denominator semantics and avoids user confusion by keeping one shared operator vocabulary. This matches the numerator filter validation pattern in `NumeratorFilterService.ts` (`updateFilters` method) and `core/domain/value-objects/FilterRule.ts`. The Zod schema provides fast-fail for completely invalid operators; the service provides type-aware validation.

**Alternatives considered**:
- Use short aliases (`EQ`, `NEQ`, `GT`, ...): Rejected — inconsistent with existing patterns.
- Database CHECK constraint on Operator per FieldType: Rejected — overly complex for a relational schema; the application layer is the correct place for type-aware operator validation.

---

### R3 — Preview Architecture

**Task**: Determine how the preview endpoint queries the external Mercury view dynamically using model-driven field→column mapping, and confirm that preview does not mutate saved configuration.

**Decision**: The preview endpoint (`POST /api/filters/denominator/{appId}/preview`) is strictly read-only — it never persists proposed rules. It accepts proposed rules, resolves each rule's `DenominatorModelId` to a `SourceColumn` via the denominator model repository, builds a parameterized dynamic SQL query against the local Mercury view snapshot, and returns current vs projected counts. The revenue column is determined by `AdoptionSettings.RevenueMetric` for the application.

**Architecture**:
1. Receive proposed rules array from request body
2. Load `DenominatorModels` to map `DenominatorModelId` → `SourceColumn` and `FieldType`
3. Load `AdoptionSettings` for the app to get the `RevenueMetric` column name
4. Build parameterized WHERE clause: each rule becomes `[SourceColumn] {Operator} @paramN`
5. Execute: `SELECT COUNT(*) AS count, SUM([RevenueColumn]) AS revenue FROM [InventoryAnalysis].[dbo].[vw_USTaxBTS_FY26_MaxACD] WHERE {clauses}`
6. Return `{ count, revenue, rules }` as preview result

**Security**: All column names come from the trusted `DenominatorModels.SourceColumn` column (seeded by migration, not user input). Values are always parameterized. This prevents SQL injection.

**In-memory test behavior**: The in-memory repository returns mock preview data from seed fixtures, ensuring test determinism without an external database dependency.

**Alternatives considered**:
- Client-side preview calculation: Rejected — would require exposing Mercury data to the frontend and duplicating filter logic.
- Query external Mercury view directly from API at request time: Rejected — couples runtime to external network availability; architecture and assumptions establish local snapshot as operational source of truth.
- Auto-save on preview: Rejected — violates preview intent and increases risk of accidental metric-impacting changes.
- Stored procedure: Viable but rejected — adds deployment complexity; parameterized dynamic SQL keeps logic in the application layer for easier testing.

---

### R4 — Audit Log Scope Discriminator

**Task**: Determine how to distinguish denominator rule audit entries from numerator rule audit entries in the shared `app.RuleChangeAudit` table, and what snapshot data to capture.

**Decision**: Add a `ChangeScope NVARCHAR(32)` column to `app.RuleChangeAudit` with values: `'Numerator'`, `'Denominator'`, `'Adoption'`. Existing rows are backfilled with `'Numerator'` (default). New denominator rule changes write `'Denominator'`; adoption setting changes write `'Adoption'`. Audit entries persist actor, app scope, previous rule set snapshot (JSON), new rule set snapshot (JSON), and UTC timestamp for successful updates only.

**Rationale**: Architecture.md v1.1.0 specifies this approach. Reusing the existing audit table avoids table proliferation while maintaining clean separation via the discriminator column. Immutable before/after snapshots satisfy constitution traceability requirements and enable compliance review.

**Alternatives considered**:
- Separate `DenominatorRuleChangeAudit` table: Rejected — duplicates identical schema; discriminator column is the standard relational approach.
- Log only metadata (no before/after snapshots): Rejected — change reconstruction would be incomplete.

---

### R5 — Denominator Model Repository Pattern

**Task**: Determine the denominator model repository interface and how it integrates with the existing `RepositoryBundle` and `RepositoryFactory`.

**Decision**: Follow the exact same pattern as existing repositories. Add `IDenominatorModelRepository` to the `RepositoryBundle` interface (`core/domain/repositories/RepositoryBundle.ts`) and wire both memory and SQL implementations in `RepositoryFactory.create()` (`infrastructure/factories/RepositoryFactory.ts`). The factory reads `env.repositoryMode` via `getAppEnv()` from `infrastructure/config/env.ts` to select the implementation.

**Key difference from numerator**: No `applicationId` parameter for `getFields()` since the model is shared.

**Interface**:

```typescript
// core/domain/repositories/IDenominatorModelRepository.ts
interface IDenominatorModelRepository {
  getFields(): Promise<DenominatorModelRow[]>;
  getFilterableFields(): Promise<DenominatorModelRow[]>;
  getNumericFields(): Promise<DenominatorModelRow[]>;
  getFieldById(denominatorModelId: string): Promise<DenominatorModelRow | null>;
}
```

**Files**:
- `core/domain/repositories/IDenominatorModelRepository.ts` — interface
- `infrastructure/persistence/memory/DenominatorModelMemoryRepository.ts` — in-memory implementation
- `infrastructure/persistence/database/DenominatorModelDbRepository.ts` — SQL implementation
- `infrastructure/persistence/database/queries/denominator-model-queries.ts` — SQL query strings

**Rationale**: Consistent with the repository pattern used throughout the codebase. In-memory implementation enables test isolation without schema changes.

**Alternatives considered**:
- Standalone factory function: Rejected — does not match the `RepositoryBundle` + `RepositoryFactory.create()` pattern used for all other repositories.

---

### R6 — Denominator Filter Repository Pattern

**Task**: Determine the denominator filter repository interface and how it differs from `INumeratorFilterRepository`.

**Decision**: Follow the same `INumeratorFilterRepository` pattern, adapted for denominator:

```typescript
// core/domain/repositories/IDenominatorFilterRepository.ts
interface IDenominatorFilterRepository {
  getRulesByApplicationId(applicationId: string): Promise<DenominatorFilterRuleRow[]>;
  replaceRules(
    applicationId: string,
    rules: DenominatorRuleInput[],
    changedBy: string,
    previousRules: DenominatorFilterRuleRow[],
  ): Promise<{ rules: DenominatorFilterRuleRow[]; auditId: string }>;
  getAuditEntries(applicationId: string, scope?: string): Promise<AuditEntry[]>;
}
```

**Key difference**: `DenominatorRuleInput` references `denominatorModelId` (not `applicationModelFieldId`). The audit write includes `ChangeScope = 'Denominator'`.

**Files**:
- `core/domain/repositories/IDenominatorFilterRepository.ts` — interface
- `infrastructure/persistence/memory/DenominatorFilterMemoryRepository.ts` — in-memory implementation
- `infrastructure/persistence/database/DenominatorFilterDbRepository.ts` — SQL implementation
- `infrastructure/persistence/database/queries/denominator-filter-queries.ts` — SQL query strings

---

### R7 — Adoption Settings Repository Pattern

**Task**: Determine the adoption settings repository interface.

**Decision**: Simple CRUD repository with UPSERT semantics (insert if not exists, update if exists). Changes to adoption settings are audit-logged via `app.RuleChangeAudit` with `ChangeScope = 'Adoption'`.

```typescript
// core/domain/repositories/IAdoptionSettingsRepository.ts
interface IAdoptionSettingsRepository {
  getByApplicationId(applicationId: string): Promise<AdoptionSettingsRow | null>;
  upsert(applicationId: string, settings: AdoptionSettingsInput, changedBy: string): Promise<AdoptionSettingsRow>;
}
```

**Files**:
- `core/domain/repositories/IAdoptionSettingsRepository.ts` — interface
- `infrastructure/persistence/memory/AdoptionSettingsMemoryRepository.ts` — in-memory implementation
- `infrastructure/persistence/database/AdoptionSettingsDbRepository.ts` — SQL implementation
- `infrastructure/persistence/database/queries/adoption-settings-queries.ts` — SQL query strings

---

### R8 — UI Component Strategy

**Task**: Determine the UI component architecture for the denominator configuration page.

**Decision**: Follow the numerator filter configuration page pattern:

| Component | Path | Purpose |
|---|---|---|
| `DenominatorRuleList.tsx` | `app/components/filters/DenominatorRuleList.tsx` | Displays current rules (read-only for viewers) |
| `DenominatorRuleEditor.tsx` | `app/components/filters/DenominatorRuleEditor.tsx` | Add/edit rule row (field dropdown, operator filtered by type, value input) |
| `DenominatorPreview.tsx` | `app/components/filters/DenominatorPreview.tsx` | Displays preview count + revenue with loading/error states |
| `AdoptionSettingsPanel.tsx` | `app/components/filters/AdoptionSettingsPanel.tsx` | Adoption level radio, revenue metric dropdown, numerator source radio |
| `DenominatorModelFields.tsx` | `app/components/filters/DenominatorModelFields.tsx` | Optional slide-out panel showing denominator model field definitions (mirrors `ApplicationModelFields.tsx`) |

**Page layout**: `app/filters/denominator/page.tsx` — application selector at top, rules list/editor, adoption settings panel, preview section at bottom.

---

### R9 — Migration Numbering

**Task**: Determine migration script numbering to avoid conflicts with existing migrations.

**Decision**: Continue from the last existing migration (`009_seed_application_model_fields.sql`). New migrations:
- `010`: Create `app.DenominatorModels` table
- `011`: Create `app.DenominatorFilterRules` table
- `012`: Create `app.AdoptionSettings` table
- `013`: Add `ChangeScope` column to `app.RuleChangeAudit`
- `014`: Seed `app.DenominatorModels` (~17 rows) and `app.AdoptionSettings` (5 rows)

**Rationale**: Sequential numbering per `database/migrations/deployment-order.md` convention.

---

### R10 — In-Memory Model Seed Data for Tests

**Task**: Determine how the in-memory denominator model repository is populated for tests.

**Decision**: `DenominatorModelMemoryRepository.ts` is pre-populated with the same ~17 Mercury view column definitions from the seed data. A constant `DENOMINATOR_MODEL_SEED` provides deterministic test data with known UUIDs.

**ID convention**: `50000000-0000-0000-{NNNN}-000000000000` where `NNNN` is a sequential 4-digit hex for each field.

**Rationale**: Matches the approach used in `NumeratorFilterMemoryRepository.ts`, which embeds `MODEL_FIELDS` seed data directly. Enables test determinism without an external database dependency.
