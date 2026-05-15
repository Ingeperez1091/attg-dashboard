# Research & Clarification Resolution: Epic 004 — Numerator Filter Configuration

**Status**: ✅ COMPLETE  
**Date**: 2026-04-15  
**Branch**: `005-numerator-filter-config`

---

## Summary

All research questions from the feature spec have been resolved. No NEEDS CLARIFICATION markers remain. This document consolidates findings from ProjectSpecifications assumptions and constitution alignment checks.

---

## Research Findings by Topic

### 1. Metadata-Driven Field Selection (Assumption A15)

**Question**: How are filterable fields defined and exposed to the filter configuration UI?

**Decision**: Application model fields are seeded in `app.ApplicationModelFields` table with field-level metadata.

**Rationale**:
- Constitution Principle II requires configuration-driven business rules with no hardcoded field names
- Assumption A15 explicitly states: "Each application's numerator payload structure is defined via the `app.ApplicationModelFields` metadata table (FieldName, FieldType, SourcePath, IsFilterable, IsMetricDimension)"
- This allows the filter UI to dynamically populate selectors from active fields (`IsActive = 1`) while disabling options where `IsFilterable = 0`
- New fields can be added by updating the metadata table without code changes

**Implementation Detail**:
- Create `app.ApplicationModelFields` table for numerator model field metadata
- Seed with all five applications' field definitions (32 total rows across Navigate, EYST, Prodigy, Maestro, Vector)
- UI reads from this table via `GET /api/applications/{appId}/numeratormodel`

**Alternatives Considered & Rejected**:
- Hardcoded field lists per application: Violates Constitution Principle II; requires code change for field additions
- Free-form filter field entry by users: No referential integrity; could reference non-existent fields; error-prone

---

### 2. Store rule sets using ordered field-operator-value rows in `app.NumeratorFilterRules`

**Decision**: Persist each rule as one row with explicit application scope and stable order (`RuleOrder`) so UI and downstream pipeline evaluation are deterministic.

**Rationale**: The architecture calls out `NumeratorFilterRules` as the source of truth. Ordered rows avoid ambiguous interpretation and support repeatable AND-based evaluation.

**Alternatives considered**:
- Store entire ruleset as one JSON blob: rejected because row-level validation, targeted querying, and operational diagnostics become harder.
- Store unordered rows only: rejected because deterministic display and processing order would be undefined.


### 3. Referential Integrity for Filter Rules (Assumption A16)

**Question**: How do we ensure filter rules reference only valid, filterable model fields?

**Decision**: `NumeratorFilterRules` table has a FK constraint linking to `ApplicationModelFields` via `ApplicationModelFieldId`.

**Rationale**:
- Assumption A16 states: "NumeratorFilterRules reference fields declared in ApplicationModelFields (via ApplicationModelFieldId FK), not arbitrary user-entered field names"
- FK constraint enforced at database layer prevents orphaned or invalid field references
- Database constraint is more reliable than application-level validation alone
- Attempt to save a rule with invalid ApplicationModelFieldId returns database error, which API translates to clear user feedback

**Implementation Detail**:
- `NumeratorFilterRules.ApplicationModelFieldId` → FK to `ApplicationModelFields.ApplicationModelFieldId`
- Delete rule on FK: RESTRICT (prevent deletion of model fields that are referenced by active rules)
- Index on (ApplicationId, ApplicationModelFieldId) for fast retrieval

**Alternatives Considered & Rejected**:
- Application-level validation only: Does not prevent race condition where field is deleted after validation but before insert
- String field names in rules: Allows invalid references; no way to detect orphaned rules after field deletion

---

### 4. Type-Aware Operator Selection (Spec FR-016)

**Question**: Which operators are valid for each field type?

**Decision**: Operator dropdown adapts to field's `FieldType` enum: text, numeric, boolean, date. Operator labels are: `EQUALS`, `NOT_EQUALS`, `CONTAINS`, `NOT_CONTAINS`, `IN_LIST`, `NOT_IN_LIST`, `GREATER_THAN`, `GREATER_OR_EQUAL`, `LESS_THAN`, `LESS_OR_EQUAL`.

**Rationale**:
- Spec FR-016 explicitly defines type → operator mappings:
   - **Text**: EQUALS, NOT_EQUALS, CONTAINS, NOT_CONTAINS, IN_LIST, NOT_IN_LIST
   - **Numeric**: EQUALS, NOT_EQUALS, GREATER_THAN, GREATER_OR_EQUAL, LESS_THAN, LESS_OR_EQUAL
   - **Boolean**: EQUALS (only)
   - **Date**: EQUALS, GREATER_THAN, GREATER_OR_EQUAL, LESS_THAN, LESS_OR_EQUAL
- Reduces user error by preventing incompatible operator-field combinations (e.g., "GREATER_THAN" on text field)
- UI can render operator dropdown after field selection by querying the field's FieldType from `ApplicationModelFields`

**Implementation Detail**:
- `ApplicationModelFields.FieldType` enum: 'text' | 'numeric' | 'boolean' | 'date'
- Create `FieldOperator` value object in domain layer that validates operator against field type
- API validates operator before persisting rule: if operator not in allowed set for FieldType, return 400 with clear feedback

**Alternatives Considered & Rejected**:
- All operators for all fields: Confusing UI; allows invalid combinations (e.g., "CONTAINS" on numeric field)
- Hard-code operator lists in UI: Requirecode change to add operators; operator metadata not centralized

---

### 5. AND-Combined Filter Rules (Assumption A9)

**Question**: How are multiple rules for one application combined?

**Decision**: Multiple filter rules are AND-combined. All rules must pass for a numerator record to be included.

**Rationale**:
- Assumption A9: "When multiple numerator filter rules are defined for an application, they are combined with AND logic"
- Spec assumes simple rule combination without OR/grouping support
- AND-combination is the most restrictive and safest default for filtering (fewer false positives)
- Simplifies both UI and ADF pipeline processing

**Implementation Detail**:
- Store rules in `NumeratorFilterRules.RuleOrder` (integer) to preserve user-defined sequence
- ADF pipeline applies rules via TSQL logic: `WHERE (rule1_condition) AND (rule2_condition) AND ...`
- No change to downstream processing required; existing ADF pipeline (EPIC-BQM-004) consumes rules as before

**Alternatives Considered & Rejected**:
- OR-combination: More permissive; could inflate numerator counts unintentionally
- Complex boolean expressions (rule groups): Requires expression parser in ADF and UI designer; out of scope for MVP

---

### 6. Per-Application Rule Isolation (Spec FR-014, FR-020)

**Question**: How do we ensure filter rules for one application don't leak into another?

**Decision**: `NumeratorFilterRules` table has `ApplicationId` column. All retrieval/update endpoints filter by the target ApplicationId. Authorization middleware enforces user can only access their assigned applications.

**Rationale**:
- Spec FR-014: "The system MUST maintain separate configurable numerator rule sets per application and prevent cross-application rule leakage"
- Spec FR-020: "The system MUST NOT display filter fields from one application when configuring another"
- Each application has distinct numerator payload structure (per Assumption A17); mixing rules across apps is nonsensical and dangerous
- Database schema and API layer both enforce isolation

**Implementation Detail**:
- Query pattern: `SELECT * FROM NumeratorFilterRules WHERE ApplicationId = @appId`
- Field selector UI query: `SELECT * FROM ApplicationModelFields WHERE ApplicationId = @appId`
- Authorization middleware: Verify user role + assignment covers requested ApplicationId before allowing read/write

**Alternatives Considered & Rejected**:
- Implicit filtering by application context: Still requires explicit verification to prevent accidental leakage
- No database constraint: Relies on application code; single bug could expose all apps' rules to all users

---

### 7: Use atomic full-replacement updates with transaction boundaries

**Decision**: `PUT` replaces the active ruleset in one transaction using soft-delete semantics (`set existing active rows IsActive = 0 + insert new active rows + audit log`) so partial updates cannot persist.

**Rationale**: This directly addresses the edge case on concurrent updates and corruption risk. A single transaction guarantees all-or-nothing mutation and preserves prior state if validation fails.

**Alternatives considered**:
- Per-rule patch operations: rejected because partial success/failure paths are harder to reason about and test.
- Multi-step update without transaction: rejected because it risks partial writes.

### 8: Define empty ruleset handling as an explicit clear operation

**Decision**: Allow `PUT` with `rules: []` as a valid explicit clear operation for authorized editors.

**Rationale**: The spec requires defined behavior for empty submissions; allowing an explicit empty set is clear, reversible through audit history, and avoids special-case endpoints.

**Alternatives considered**:
- Reject empty ruleset as validation error: rejected because this blocks intentional resets and adds UX friction.
- Add a separate clear endpoint: rejected because it duplicates authorization and auditing logic.

### 9. Authorization & Audit Logging

**Question**: Who can view/edit filter rules, and how do we audit changes?

**Decision**: Role-based access control (RBAC) via three roles:
- **administrator**: View/edit all applications' rules
- **application_owner**: View/edit only assigned applications' rules
- **viewer**: View assigned applications' rules (read-only)

All mutations are audit-logged with actor, previous value, new value, timestamp.

**Rationale**:
- Constitution Principle II requires RBAC enforcement
- Constitution Principle I requires audit logging on all data changes
- Three roles defined in EPIC-BQM-003 (User Administration); reuse same roles for consistency
- Per-application assignment stored in `app.UserApplications` table (existing schema)

**Implementation Detail**:
- `filterAuthorizationMiddleware` checks session user's role + assignments before route handler executes
- Audit columns on `NumeratorFilterRules` table: `CreateDate`, `CreatedBy`, `UpdateDate`, `UpdatedBy`
- Update endpoint soft-deletes previous active rows (`IsActive = 0` with timestamp/actor updates) before inserting new active rows
- Query pattern: `INSERT INTO app.RuleChangeAudit (ApplicationId, ActorUserId, PreviousRulesJson, NewRulesJson, ChangedAt)`

**Alternatives Considered & Rejected**:
- No audit trail: Violates Constitution Principle I (Data Integrity First)
- Hard delete of old rules: Rejected in favor of soft-delete because historical row-level traceability is required and active-only retrieval can be handled with `IsActive = 1` filtering

---

### 10: Capture immutable audit entries for every accepted rule change

**Decision**: Each accepted update records actor, application, previous rules snapshot, new rules snapshot, and UTC timestamp in an audit log record.

**Rationale**: Satisfies FR-012 and constitution requirements for traceability and governance.

**Alternatives considered**:
- Log only metadata without before/after values: rejected because change reconstruction would be impossible.
- Audit only administrator changes: rejected because all accepted changes are governance-relevant.

### 11. Performance Target (Spec SC-004)

**Question**: What's the acceptable latency for filter retrieval and update operations?

**Decision**: 95% of valid rule retrieval and update operations must complete in ≤3 seconds under normal load.

**Rationale**:
- Spec SC-004: "At least 95% of valid rule retrieval and update operations complete in 3 seconds or less under normal load"
- 3-second threshold aligns with dashboard responsiveness expectations (no perceptible UI lag)
- "Normal load": Expected ~5 concurrent users per application; ~50 filter rules per application max

**Implementation Detail**:
- Create clustered index on `(ApplicationId, RuleOrder)` for fast sorted retrieval
- Use parameterized queries (mssql driver) to avoid SQL injection and leverage query plan caching
- In-memory repository for contract/integration tests; SQL repository for performance validation integration tests
- Monitor query execution time in CI via Vitest performance assertions

**Alternatives Considered & Rejected**:
- No performance target: Risk of poor user experience during peak load
- Caching rules in Redis: Added complexity; invalidation logic required; not justified given expected data volumes

---

### 12. Database Design Decisions

**Entities**:
1. **ApplicationModelFields** (new)
   - `ApplicationModelFieldId` (PK)
   - `ApplicationId` (FK)
   - `FieldName` (string, e.g., "NavigateStatus")
   - `FieldType` (enum: text/numeric/boolean/date)
   - `SourcePath` (string, e.g., "$.status")
   - `IsFilterable` (boolean)
   - `IsMetricDimension` (boolean)
   - `DisplayOrder` (integer)
   - Audit columns: CreateDate, CreatedBy, UpdateDate, UpdatedBy

2. **NumeratorFilterRules** (new)
   - `RuleId` (PK)
   - `ApplicationId` (FK)
   - `ApplicationModelFieldId` (FK to ApplicationModelFields)
   - `Operator` (string, e.g., "EQUALS", "CONTAINS", "GREATER_THAN")
   - `Value` (string, e.g., "Active", "100", "true")
   - `RuleOrder` (integer, for sequencing)
   - Audit columns: CreateDate, CreatedBy, UpdateDate, UpdatedBy

3. **RuleChangeAudit** (required, for full change tracking)
   - `AuditId` (PK)
   - `ApplicationId` (FK)
   - `PreviousRuleSet` (JSON, snapshot of rules before change)
   - `NewRuleSet` (JSON, snapshot of rules after change)
   - `ChangedBy` (NVARCHAR(255) actor)
   - `ChangeDate` (datetime)

**Indexes**:
- `ApplicationModelFields`: (ApplicationId, IsFilterable) — for UI field selector queries
- `NumeratorFilterRules`: (ApplicationId, RuleOrder) — primary retrieval pattern; supports sorted list display
- `NumeratorFilterRules`: (ApplicationModelFieldId) — for referential integrity checks

---

### 13: Seed application model definitions as a database migration

**Decision**: Create a dedicated migration script `009_seed_application_model_fields.sql` that uses MERGE to idempotently insert **32 field definitions** across all five applications:

| Application | Fields | Filterable | Metric Dims | Source Document |
|-------------|:------:|:----------:|:-----------:|-----------------|
| Maestro | 5 | 2 | 1 | Architecture §Payload Templates + Business Rules §1 |
| EYST | 7 | 4 | 3 | Architecture §EYST Template + Business Rules §2 |
| Prodigy | 7 | 3 | 2 | Architecture §Prodigy Template + Business Rules §3 |
| Vector | 6 | 4 | 3 | Architecture §Vector + Business Rules §4 |
| Navigate | 7 | 2 | 2 | Architecture §Navigate Template + Business Rules §5 |

Field definitions are derived from:
- **Payload Template by Application** tables in `../../Documentation/StakeholderDocuments/AUTOMATED_SOLUTION_ARCHITECTURE.md`
- **Per-application business rules** in `../../Documentation/StakeholderDocuments/BUSINESS_RULES_AND_ETL_SUMMARY.md` (field types, valid values, match keys, classification logic)

**Rationale**: Satisfies FR-017 and FR-018. MERGE pattern matches existing seed scripts (applications, roles, superadmin). Idempotency allows safe re-execution. Concrete field definitions eliminate ambiguity in the seed script.

**Alternatives considered**:
- Seed via API calls at startup: rejected because it couples application code with data requirements and complicates test isolation.
- Manual INSERT scripts without idempotency: rejected because re-runs would fail or create duplicates.
- Fewer seed fields (filterable only): rejected because non-filterable context fields (ClientName, EngagementName, Notes) are required by ADF for JSON parsing and by the UI for display.

### 14: Add PowerShell migration runner with rollback support

**Decision**: Create `scripts/database/run-migrations.ps1` that applies numbered migration scripts sequentially, and `scripts/database/run-rollback.ps1` that reverses them in descending order. Each forward migration has a matching `database/rollback/rollback_NNN_*.sql` script.

**Rationale**: User requirement to include a PS1 file for migration execution and rollback capability. Sequential numbering matches existing migration convention. Rollback scripts enable safe recovery.

**Alternatives considered**:
- Entity Framework Core migrations: rejected because the project uses raw T-SQL migrations with `sqlcmd` and has no EF Core dependency.
- Single monolithic rollback script: rejected because it cannot target specific migration ranges.

### 15: Relocate database/ps_scripts/ to scripts/database/

**Decision**: Move `database/ps_scripts/setup-database.ps1` and `database/ps_scripts/run-mercury-validation.ps1` to `scripts/database/`. New migration and rollback runners also go under `scripts/database/`.

**Rationale**: User requirement. Consolidates all PowerShell tooling under a single `scripts/` hierarchy alongside existing `scripts/ci/`. Database folder retains SQL-only assets (migrations, schema, seed, rollback, sqlproject, views).

**Alternatives considered**:
- Keep scripts in `database/ps_scripts/`: rejected because user explicitly requested the move and the mixed layout is inconsistent with the `scripts/ci/` convention.

### 16: Rollback implementation design

**Decision**: Each forward migration script (006-009) has a corresponding rollback script in `database/rollback/` that reverses the changes. Rollback scripts are named `rollback_NNN_*.sql` and are executed in reverse numerical order. The rollback runner accepts a `-From` and `-To` parameter to rollback a range.

**Rationale**: Provides targeted recovery without requiring full database recreation. Rollback for table creation is `DROP TABLE IF EXISTS`. Rollback for seed data is `DELETE` with the known application model IDs.

**Alternatives considered**:
- Point-in-time restore from Azure SQL backup: rejected as too coarse-grained for development workflow; appropriate for production disaster recovery but not for iterative migration testing.
- Compensating transactions within the forward script: rejected because it complicates the forward script and makes debugging harder.


## Alignment with Constitution & Assumptions

✅ **Principle I (Data Integrity First)**: All rule changes audit-logged; invalid changes rejected before persistence  
✅ **Principle II (Configuration-Driven Business Rules)**: Filter rules fully configurable via UI; model-driven field selection  
✅ **Principle III (Validated Data Ingestion)**: Rules validated against ApplicationModelFields FK before storage  
✅ **Principle IV (Test-First Development)**: Contract tests validate schemas/status codes; integration tests cover full flow  
✅ **Assumption A9 (AND-Combined Rules)**: Implemented via rule ordering and ADF pipeline logic  
✅ **Assumption A15 (Metadata-Driven Models)**: ApplicationModelFields table drives UI and validation  
✅ **Assumption A16 (FK Links)**: NumeratorFilterRules.ApplicationModelFieldId enforces referential integrity  
✅ **Assumption A17 (Payload Template Stability)**: Metadata table allows field additions without code changes  

---

## Conclusion

All research questions have been answered with evidence-based decisions grounded in the ProjectSpecifications and constitution. No blockers remain for Phase 1 design and Phase 2 implementation.

**Next Steps**: Generate `data-model.md`, `contracts/`, and `quickstart.md` as Phase 1 design artifacts.
