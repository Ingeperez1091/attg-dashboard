# Feature Specification: Epic 004 Numerator Filter Configuration

**Feature Branch**: `[005-numerator-filter-config]`  
**Created**: 2026-04-15  
**Updated**: 2026-04-15  
**Status**: Ready  
**Input**: EPIC-BQM-004 — Numerator Filter Configuration (metadata-driven application model update)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Numerator Filter Rules by Application Scope (Priority: P1)

As an application owner, I want to view numerator filter rules for my assigned applications — with filter field names dynamically sourced from the application's model metadata — so that I can understand what criteria are currently applied before numerator records contribute to adoption metrics.

**Why this priority**: Visibility of current rules is foundational for trust and governance. Users cannot safely manage filter behavior without first seeing active rule sets. The model-driven display ensures field names are always valid and consistent with the application's actual data structure.

**Independent Test**: Can be fully tested by signing in as each role type and verifying that only the correct application rule sets are returned, displayed, and that field names resolve from the application model.

**Acceptance Scenarios**:

1. **Given** I am an `application_owner` assigned to one or more applications, **When** I open numerator filter configuration, **Then** I can view rules only for those assigned applications.
2. **Given** I am a `viewer`, **When** I open numerator filter configuration, **Then** I can view rules for assigned applications in read-only mode.
3. **Given** I am an `administrator`, **When** I open numerator filter configuration, **Then** I can view rules for all active applications.
4. **Given** filter rules exist for an application, **When** displayed, **Then** each rule shows the resolved field name from the application model, the operator, and the value.
5. **Given** an application's model defines both filterable and non-filterable fields, **When** I view the filter configuration, **Then** all active fields appear and fields with `isFilterable=false` are shown as disabled for rule selection.

---

### User Story 2 - Create and Edit Numerator Filter Expressions (Priority: P2)

As an authorized business owner, I want to create and update numerator filter expressions by selecting fields from my application's model metadata so that rule changes use validated, model-defined fields and can be managed without engineering intervention.

**Why this priority**: This is the primary business outcome of Epic 004 and directly supports the constitution principle that business rules be configuration-driven. The model-driven field selection ensures referential integrity — users can only filter on fields that actually exist in the application's data structure.

**Independent Test**: Can be tested independently by creating and editing rule expressions for an authorized application, confirming the field selector shows all active model fields with non-filterable fields disabled, that operators adapt to field type, and that non-filterable submissions are rejected with HTTP 400.

**Acceptance Scenarios**:

1. **Given** I am authorized to edit filters for an application, **When** I open the rule editor, **Then** the field selector shows all active application model fields and disables non-filterable ones.
2. **Given** I select a text-type field (e.g. NavigateStatus), **When** the operator dropdown renders, **Then** it offers text-appropriate operators (EQUALS, NOT_EQUALS, CONTAINS, NOT_CONTAINS, IN_LIST, NOT_IN_LIST).
3. **Given** I select a numeric-type field (e.g. RevenueFYTD), **When** the operator dropdown renders, **Then** it offers numeric-appropriate operators (EQUALS, NOT_EQUALS, GREATER_THAN, GREATER_OR_EQUAL, LESS_THAN, LESS_OR_EQUAL).
4. **Given** I submit a valid set of filter expressions referencing model-defined fields, **When** saved, **Then** the system persists the rule set with each rule linked to its model field and returns the updated configuration.
5. **Given** an existing rule set, **When** I edit one or more expressions and save, **Then** the system replaces the prior active configuration with the new validated configuration.
6. **Given** a rule entry that references a field not marked as filterable or not defined in the model, **When** I attempt to save, **Then** the backend rejects the request with HTTP 400 (`FIELD_NOT_FILTERABLE` or equivalent validation code) and leaves the previous configuration unchanged.
7. **Given** a rule entry with invalid expression structure, **When** I attempt to save, **Then** the system rejects the request with clear validation feedback and leaves the previous configuration unchanged.

---

### User Story 3 - Enforce Role and Assignment Boundaries for Rule Changes (Priority: P3)

As a platform administrator, I want edit rights enforced by role and application assignment so that only authorized users can modify numerator filter rules.

**Why this priority**: Unauthorized filter changes can materially distort adoption outcomes and violate governance controls.

**Independent Test**: Can be tested independently by attempting edit operations as `viewer`, unassigned `application_owner`, assigned `application_owner`, and `administrator`.

**Acceptance Scenarios**:

1. **Given** I am a `viewer`, **When** I attempt to modify numerator filter rules, **Then** the system denies the request.
2. **Given** I am an `application_owner` not assigned to the target application, **When** I attempt to modify rules, **Then** the system denies the request.
3. **Given** I am an assigned `application_owner` or `administrator`, **When** I modify rules for an allowed application, **Then** the system accepts the change.
4. **Given** any accepted rule change, **When** the update is committed, **Then** an audit record captures the actor, previous value, new value, and timestamp.

---

### User Story 4 - Seed Application Model Definitions (Priority: P0)

As a platform engineer, I want application model field definitions seeded for all five in-scope applications so that the filter configuration UI and processing pipeline can dynamically discover each application's data structure.

**Why this priority**: P0 because all other stories depend on model data being present. Without seeded model definitions, the field selector is empty and no filter rules can be created.

**Independent Test**: Can be fully tested by querying the application model data for each application and verifying field names, types, filterability flags, and display ordering match the documented payload templates.

**Acceptance Scenarios**:

1. **Given** the system is deployed, **When** the seed process completes, **Then** the application model contains field definitions for all five applications (Navigate: 7 fields, EYST: 7 fields, Prodigy: 7 fields, Maestro: 5 fields, Vector: 6 fields).
2. **Given** the Navigate model, **When** queried for filterable fields, **Then** exactly `RevenueFYTD` and `NavigateStatus` are returned.
3. **Given** the EYST model, **When** queried for filterable fields, **Then** exactly `EngagementCount`, `TotalRevenueETD`, `EYSTActive`, and `EYSTDataCleanupActive` are returned.
4. **Given** the Maestro model, **When** queried for filterable fields, **Then** exactly `ClientId` and `InMaestro` are returned.
5. **Given** the Prodigy model, **When** queried for filterable fields, **Then** exactly `EngagementCount`, `TotalRevenueFYTD`, and `Override` are returned.
6. **Given** the Vector model, **When** queried for filterable fields, **Then** exactly `ClientId`, `RevenueFYTD`, `RevenueETD`, and `VectorEngagement` are returned.
7. **Given** the seed process is run again, **When** completed, **Then** no duplicate model entries are created (idempotent).
8. **Given** the model data is available, **When** the filter configuration UI or retrieval endpoint is accessed, **Then** field definitions including name, type, filterability, and display order are returned.

### Edge Cases

- Rule expression values that include commas, spaces, or mixed-case tokens must be parsed and stored consistently.
- Submitting an empty rule set must follow a defined behavior (either explicit clear operation or validation failure) and be handled consistently.
- Concurrent updates by two authorized users on the same application must not produce partial or merged rule corruption.
- Attempts to edit rules for inactive or unknown applications must be rejected without mutating any stored configuration.
- Large rule lists for a single application must remain viewable and editable without truncation or silent loss.
- A filter rule referencing a model field that is later removed or marked non-filterable must be handled gracefully (e.g. flagged as orphaned, not silently applied).
- Each application has a different set of filterable fields; the UI must not display fields from one application when configuring another.
- Operator options must adapt to the selected field's data type — offering only type-appropriate operators.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a numerator filter configuration view per application.
- **FR-002**: The system MUST scope visible applications by user role and assignment.
- **FR-003**: The system MUST allow `administrator` users to view and edit numerator filter rules for all active applications.
- **FR-004**: The system MUST allow `application_owner` users to view and edit numerator filter rules only for applications assigned to them.
- **FR-005**: The system MUST allow `viewer` users to view assigned application filter rules in read-only mode.
- **FR-006**: The system MUST support creating and editing dynamic field-operator-value filter expressions where the field selector is populated from all active fields in the application's model metadata, and fields marked as non-filterable are displayed as disabled.
- **FR-007**: The system MUST validate submitted filter expressions to ensure each rule references a valid, filterable model field for the target application.
- **FR-008**: The system MUST reject invalid filter updates (including rules referencing non-existent or non-filterable model fields) with HTTP 400 and preserve the previously active rule set.
- **FR-009**: The system MUST expose a retrieval operation for current numerator filters for a selected application, resolving field references to human-readable model field names.
- **FR-010**: The system MUST expose an update operation for numerator filters for a selected application, with authorization checks.
- **FR-011**: The system MUST reject unauthorized or out-of-scope edit attempts.
- **FR-012**: The system MUST audit-log every accepted rule change with actor, previous value(s), new value(s), and timestamp.
- **FR-013**: The system MUST return deterministic structured responses for success, validation errors, and authorization errors.
- **FR-014**: The system MUST maintain separate configurable numerator rule sets per application and prevent cross-application rule leakage.
- **FR-015**: The system MUST expose a retrieval operation for application model field definitions, returning each field's name, data type, filterability, metric-dimension status, and display order.
- **FR-016**: The system MUST present operator options appropriate to the selected field's data type: text fields offer EQUALS, NOT_EQUALS, CONTAINS, NOT_CONTAINS, IN_LIST, NOT_IN_LIST; numeric fields offer EQUALS, NOT_EQUALS, GREATER_THAN, GREATER_OR_EQUAL, LESS_THAN, LESS_OR_EQUAL; boolean fields offer EQUALS; date fields offer EQUALS, GREATER_THAN, GREATER_OR_EQUAL, LESS_THAN, LESS_OR_EQUAL.
- **FR-017**: The system MUST seed application model field definitions for all five in-scope applications (Navigate, EYST, Prodigy, Maestro, Vector) with correct field names, types, filterability flags, metric-dimension flags, and display ordering as documented in the architecture specification.
- **FR-018**: The seed process MUST be idempotent — re-running it must not create duplicate model entries.
- **FR-019**: Each filter rule MUST maintain referential integrity to its application model field definition.
- **FR-020**: The system MUST NOT display filter fields from one application when configuring another application.
- **FR-021**: The system MUST store historical rule-change snapshots in `RuleChangeAudit` for historical/audit purposes, while exposing rule-level `CreatedBy` and `UpdatedBy` metadata to support current-configuration audit display in the UI.

### Key Entities *(include if feature involves data)*

- **Application Model**: Metadata declaring the field structure for a specific application's numerator payload. Each field has a name, data type, JSON source path, filterability flag, metric-dimension flag, and display order. The model is seeded per application and drives both the filter UI and ADF pipeline processing.
- **Application Model Field**: A single entry within an application model, representing one data attribute (e.g., `NavigateStatus` for Navigate, `InMaestro` for Maestro). Fields marked as filterable can be used in filter rules; fields marked as metric dimensions contribute to aggregation.
- **Numerator Filter Rule**: A single field-operator-value expression used to include or exclude numerator records. The field reference links to an application model field (not a freeform string), ensuring referential integrity.
- **Application Rule Set**: The ordered collection of numerator filter rules currently active for one application. Rules are AND-combined.
- **Rule Change Audit Entry**: Immutable log record capturing who changed rules, what changed, and when.
- **User Assignment Context**: Role and application-assignment data used to determine view/edit permissions.
- **Application Configuration Scope**: Active/inactive application status and identity used to validate filter target boundaries.

### Per-Application Filterable Fields Summary

The following fields are filterable for each application (as defined in the architecture payload templates):

| Application | Filterable Fields | Key Data Types |
|-------------|-------------------|----------------|
| Navigate | RevenueFYTD, NavigateStatus | numeric, string |
| EYST | EngagementCount, TotalRevenueETD, EYSTActive, EYSTDataCleanupActive | numeric, numeric, string, string |
| Prodigy | EngagementCount, TotalRevenueFYTD, Override | numeric, numeric, string |
| Maestro | ClientId, InMaestro | string, boolean |
| Vector | ClientId, RevenueFYTD, RevenueETD, VectorEngagement | string, numeric, numeric, string |

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of authorized users can retrieve numerator rule sets for applications they are permitted to access, with field names resolved from the application model.
- **SC-002**: 100% of unauthorized edit attempts are rejected with a forbidden response and no rule mutation.
- **SC-003**: 100% of accepted rule updates generate an audit entry containing actor, previous value(s), new value(s), and timestamp.
- **SC-004**: At least 95% of valid rule retrieval and update operations complete in 3 seconds or less under normal load.
- **SC-005**: During acceptance validation, business users can create and edit numerator rules for each in-scope application without engineering support, selecting from model-defined filterable fields.
- **SC-006**: 100% of invalid rule submissions (including references to non-filterable or non-existent model fields) return clear validation feedback and leave the prior active rule set unchanged.
- **SC-009**: 100% of attempts to submit non-filterable fields in rule updates return HTTP 400 validation responses.
- **SC-007**: All five applications have complete model field definitions seeded, and the seed process can run idempotently without creating duplicates.
- **SC-008**: Operator options presented in the filter editor are appropriate to the selected field's data type for 100% of model-defined filterable fields.

## Assumptions

- Existing role and application assignment data from user administration is available and trusted for authorization checks.
- In-scope applications (Maestro, EYST, Prodigy, Vector, Navigate) are pre-seeded and managed as application catalog entries.
- Each application's numerator payload structure is declared via application model metadata (field name, type, JSON source path, filterability, metric-dimension flag). This model is seeded at deployment and drives the filter UI and processing pipeline (see Architecture Assumption A15).
- Filter rules reference model-defined fields via referential link, not freeform field name strings. Only fields marked as filterable in the application model can be selected for filter rules (see Architecture Assumption A16).
- Per-application payload templates are known and stable through MVP and Extended-MVP. Changes are handled by updating application model metadata, not code (see Architecture Assumption A17).
- When multiple numerator filter rules are defined for an application, they are combined with AND logic. OR-combination or complex boolean groupings are not required (see Architecture Assumption A9).
- Denominator rule configuration is out of scope for this feature and remains separate work.
- Pre-apply impact preview for proposed rule changes is intentionally out of scope for this epic and deferred to a future design.
- Rule execution in the downstream processing pipeline is handled by a separate epic; this feature covers configuration storage, retrieval, model-aware UI, and access control only.
- Business users define rule intent via supported operator semantics and are responsible for selecting valid business values.
- The system uses existing audit conventions for timestamp and user attribution fields. 
