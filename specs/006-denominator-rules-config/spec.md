# Feature Specification: EPIC-008 Denominator Rules Configuration

**Feature Branch**: `[006-denominator-rules-config]`  
**Created**: 2026-04-15 
**Status**: Ready  
**Input**: User description: "epic-008-denominator-rules-config"

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->


### User Story 1 - View Denominator Rules for an Application (Priority: P1)

As an **application owner or administrator**, I want to view the current denominator filter rules for a selected application, so that I can understand how the addressable population (denominator) is being defined.

**Why this priority**: Viewing existing rules is the foundational action — every other workflow (editing, previewing, auditing) depends on being able to see the current configuration. The available filter fields are driven by a shared denominator model that defines the Mercury view columns.

**Independent Test**: Can be tested by selecting an application from the filter configuration page and verifying that all configured rules are displayed with their field name (from the shared denominator model), operator, and value.

**Acceptance Scenarios**:

1. **Given** an administrator is on the Denominator Configuration page, **When** they select "Maestro" from the application selector, **Then** the page displays the current denominator rules for Maestro showing each rule's field name (e.g., EngagementServiceCode), operator (e.g., EQUALS), and value (e.g., 11420), along with any other active rules (release date, excluded name patterns, revenue threshold, engagement statuses).
2. **Given** a viewer is on the Denominator Configuration page, **When** they select an assigned application, **Then** they see all denominator rules in read-only mode with no edit controls visible.
3. **Given** an application owner is on the Denominator Configuration page, **When** they select an application they are NOT assigned to, **Then** the system returns a not-found response and no rules are displayed.
4. **Given** an administrator views Maestro rules, **When** the page loads, **Then** only fields marked as filterable in the shared denominator model are available in the field selector dropdown.

---

### User Story 2 - Edit Denominator Rules (Priority: P1)

As an **application owner**, I want to edit the denominator filter rules for my assigned applications by selecting fields from the shared denominator model, choosing operators, and providing values, so that I can adjust the addressable population criteria when business needs change (e.g., quarterly updates).

**Why this priority**: Self-service rule editing is the core value proposition — it eliminates the need for code changes to adjust denominator criteria. The model-driven approach ensures only valid Mercury view fields can be selected.

**Independent Test**: Can be tested by adding a new rule (selecting a field, operator, and value), saving, and verifying the rule persists and is returned on subsequent page loads.

**Acceptance Scenarios**:

1. **Given** an application owner is viewing rules for an assigned application, **When** they add a new rule by selecting a field (e.g., EngagementServiceCode) from the filterable fields dropdown, choosing an operator (e.g., IN_LIST), entering a value, and clicking Save, **Then** the new rule is persisted and visible on page reload.
2. **Given** an administrator is editing rules for any application, **When** they add a rule for a text field (e.g., Engagement) with operator CONTAINS and a value pattern, **Then** the pattern-based rule is saved and appears in the rules list.
3. **Given** a viewer is viewing rules for an assigned application, **When** they attempt to access the edit interface, **Then** no edit controls are available and the PUT endpoint returns 403 if called directly.
4. **Given** an owner adds a rule for a numeric field, **When** they select an operator valid for numbers (GREATER_THAN, GREATER_OR_EQUAL, LESS_THAN, LESS_OR_EQUAL, EQUALS, NOT_EQUALS) and enter a value, **Then** the system validates the value is a valid number before saving.
5. **Given** an owner adds a rule for a date field, **When** they select an operator valid for dates (GREATER_THAN, GREATER_OR_EQUAL, LESS_THAN, LESS_OR_EQUAL) and enter a date, **Then** the system validates the date format before saving.

---

### User Story 3 - Preview Denominator Impact Before Saving (Priority: P2)

As an **application owner or administrator**, I want to preview the impact of my rule changes on the denominator count and revenue totals before applying them, so that I can confirm the changes produce the expected addressable population.

**Why this priority**: Previewing prevents accidental misconfiguration by showing the consequences of rule changes before they take effect. The preview uses the same model-driven field-to-column mapping to query the Mercury view dynamically.

**Independent Test**: Can be tested by modifying a rule value and clicking "Preview" to see updated record count and revenue totals without saving.

**Acceptance Scenarios**:

1. **Given** an owner has modified the rules for Vector (e.g., changed minimum revenue threshold), **When** they click "Preview", **Then** the system displays the projected denominator count and total revenue based on the modified rules without persisting changes.
2. **Given** an administrator previews rule changes, **When** the preview results show a dramatically different count, **Then** they can choose to discard changes or proceed with save.
3. **Given** the external Mercury data source is unavailable, **When** the user requests a preview, **Then** the system displays a clear error message indicating the preview could not be calculated.
4. **Given** multiple rules are active for an application, **When** the preview executes, **Then** all rules are combined with AND logic to produce the projected count and revenue.

---

### User Story 4 - Configure Adoption Settings (Priority: P2)

As an **administrator or application owner**, I want to configure adoption-level settings (Adoption Level, Revenue Metric, Numerator Source) per application, so that the metrics pipeline knows how to calculate adoption for each application.

**Why this priority**: Adoption settings determine how metrics are calculated — specifically which match key type (Engagement ID vs Client ID) and which revenue column to use. They are closely related to denominator rules and should be managed in the same interface.

**Independent Test**: Can be tested by changing the Adoption Level from "Engagement" to "Client" for an application, saving, and verifying the setting persists.

**Acceptance Scenarios**:

1. **Given** an administrator is on the Denominator Configuration page for Prodigy, **When** they set Adoption Level to "Client" and Revenue Metric to "ETD_ANSRAmt", **Then** these settings are persisted and returned on subsequent loads.
2. **Given** an application owner views their assigned application, **When** the adoption settings section is displayed, **Then** it shows the current Adoption Level, Revenue Metric, and Numerator Source values.
3. **Given** the Revenue Metric dropdown is displayed, **When** the user opens it, **Then** only numeric fields from the shared denominator model are listed as selectable options.

---

### User Story 5 - Audit Trail for Denominator Rule Changes (Priority: P3)

As an **administrator**, I want all denominator rule modifications to be audit-logged with the user, previous values, new values, and timestamp, so that I can track who changed what and when.

**Why this priority**: Audit logging is a compliance requirement but does not directly affect daily user workflows; it supports traceability after the core editing capability is in place.

**Independent Test**: Can be tested by modifying a rule, saving, and verifying the audit log contains the correct user, old value, new value, and timestamp.

**Acceptance Scenarios**:

1. **Given** an application owner saves a denominator rule change, **When** the save completes, **Then** an audit record is created with the user identity, previous rule values, new rule values, and a UTC timestamp.
2. **Given** a rule save fails validation, **When** the system rejects the change, **Then** no audit record is created.

---

### User Story 6 - Govern Field Choices by Denominator Model (Priority: P3)

As an application owner, I want denominator rules to be built only from approved denominator model fields and valid operators, so that rule definitions remain consistent and safe across applications.

**Why this priority**: Controlled field/operator choices reduce invalid configurations and maintain consistent behavior across shared denominator data.

**Independent Test**: Can be tested by attempting to save valid and invalid field/operator combinations and verifying only allowed combinations are accepted.

**Acceptance Scenarios**:

1. **Given** a user configures a denominator rule, **When** they choose a field, **Then** only approved denominator model fields are available.
2. **Given** a rule contains a field/operator/value combination outside allowed validation rules, **When** save is attempted, **Then** the request is rejected with a clear validation message.

---

### Edge Cases

- What happens when an application has no denominator rules configured yet? — The system displays an empty rules list with the field selector available for adding new rules. The preview shows the unfiltered denominator count.
- What happens when a user tries to create a duplicate rule (same field, operator, and value)? — The system prevents duplicate entries and displays a validation error.
- What happens when the Mercury data source is unreachable during preview? — The preview returns an error message; saving is still allowed since rules are configuration-only.
- What happens when two users edit the same application's rules simultaneously? — The last save wins, but the audit log captures both changes with their respective timestamps.
- How does the system handle invalid date formats in a date field rule? — Input validation rejects non-date values before submission, based on the field's type from the denominator model.
- What happens when all rules together produce zero denominator records? — The system allows saving but the preview warns the user of a zero-count outcome.
- What happens when a field is deactivated in the denominator model? — Existing rules referencing that field remain but the field no longer appears in the field selector for new rules. Existing rules with deactivated fields are flagged visually.
- What happens when an operator is invalid for the field type (e.g., CONTAINS on a numeric field)? — The operator dropdown only shows operators valid for the selected field's type (text, numeric, or date).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a denominator rules configuration interface within the Filter Configuration section, accessible via application selector.
- **FR-002**: System MUST present filter fields dynamically from a shared denominator model that defines the Mercury view columns. Only fields marked as filterable in the model are selectable. Each rule consists of: a field (from the model), an operator, and a value.
- **FR-003**: System MUST support the following operators, constrained by field type, using the same canonical labels as numerator filter configuration: **Text** fields — EQUALS, NOT_EQUALS, IN_LIST, NOT_IN_LIST, CONTAINS, NOT_CONTAINS; **Numeric** fields — EQUALS, NOT_EQUALS, GREATER_THAN, GREATER_OR_EQUAL, LESS_THAN, LESS_OR_EQUAL; **Date** fields — EQUALS, GREATER_THAN, GREATER_OR_EQUAL, LESS_THAN, LESS_OR_EQUAL.
- **FR-004**: System MUST allow `administrator` users to view and edit denominator rules for all applications.
- **FR-005**: System MUST allow `application_owner` users to view and edit denominator rules only for their assigned applications.
- **FR-006**: System MUST restrict `viewer` users to read-only access of denominator rules for their assigned applications.
- **FR-007**: System MUST provide API endpoints for retrieving the shared denominator model (`GET /api/denomindator-model`) and for retrieving and updating denominator rules per application (`GET` and `PUT /api/filters/denominator/{appId}`).
- **FR-008**: System MUST provide a preview capability that shows projected denominator count and revenue total based on current or modified rules without persisting changes.
- **FR-009**: System MUST provide a preview API endpoint (`POST /api/filters/denominator/{appId}/preview`) that accepts a proposed rule set and returns projected counts and revenue using the per-application revenue metric from adoption settings.
- **FR-010**: System MUST combine multiple rules for an application using AND logic — all rules must pass for a record to be included in the addressable population.
- **FR-011**: System MUST support adoption settings per application through `GET` and `PUT /api/filters/denominator/{appId}/settings`: Adoption Level (Engagement or Client), Revenue Metric (selectable from numeric fields in the shared denominator model), and Numerator Source (API or Manual).
- **FR-012**: System MUST persist all denominator rule changes with an audit record containing: user identity, previous rule values (as a snapshot), new rule values (as a snapshot), a scope discriminator distinguishing denominator from numerator audits, and a UTC timestamp.
- **FR-013**: System MUST validate all inputs before saving: values for numeric fields must be valid non-negative numbers, values for date fields must be valid date formats, text values must be non-empty, and duplicate rules (same field, operator, value) must be rejected.
- **FR-014**: System MUST support the five known applications (Maestro, EYST, Prodigy, Vector, Navigate) with their distinct default rule configurations as documented in the Current Application Rules Summary.
- **FR-015**: System MUST display a warning when a preview returns zero denominator records.

### Key Entities *(include if feature involves data)*

- **Denominator Filter Rule Set**: A complete, ordered collection of denominator rules for one application, including active status and last update metadata.
- **Denominator Filter Rule**: A per-application rule that references a denominator model field (by identity), specifies an operator and value, and has a sort order. Multiple rules per application are combined with AND logic.
- **Denominator Model**: A shared metadata definition representing a single column of the Mercury view. Attributes include logical field name, data type (text, numeric, date), the source column reference in the Mercury view, whether the field is filterable, and a display order. The full set of model entries (~17) defines the Mercury view schema once, shared across all applications.
- **Denominator Impact Preview**: A read-only transient comparison result containing current and projected denominator count and revenue outcomes for a proposed rule set.
- **Rule Change Audit Entry**: An immutable audit record capturing who changed which application's rules, what the previous values were (as a JSON snapshot), the new values (as a JSON snapshot), the scope (denominator, numerator, or adoption), and when the change occurred.
- **Application**: The existing application entity (Maestro, EYST, Prodigy, Vector, Navigate) to which rules are scoped.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Application owners can view and update denominator rules for an assigned application within 2 minutes, end to end.
- **SC-002**: Denominator preview results display within 5 seconds of clicking "Preview" under normal data volumes.
- **SC-003**: 100% of denominator rule changes are captured in the audit log with correct user, old values, new values, and timestamp.
- **SC-004**: Viewers cannot modify denominator rules through the UI or API — all write attempts are rejected.
- **SC-005**: All five applications display accurate current rule configurations matching the documented business rules.
- **SC-006**: The denominator configuration page loads and is usable within 3 seconds.
- **SC-007**: Business owners can adjust denominator criteria without any code changes or developer involvement.

## Assumptions

- The external Mercury denominator data is accessible via the existing SQL view (`vw_USTaxBTS_FY26_MaxACD`) for preview calculations. Preview depends on this data source being reachable.
- The existing application and user/role infrastructure (from Epics 001 and 002) are in place and functional.
- Denominator rules are configuration data stored in the application database, not in the external Mercury system.
- The preview feature queries the Mercury view in real-time; no cached copy of Mercury data is maintained for preview.
- The audit log stores serialized snapshots of old and new rule values (not individual field-level diffs), with a scope discriminator to distinguish denominator rule changes from numerator rule changes.
- The Mercury view has a single, fixed schema shared by all five applications (Architecture Assumption A12). The denominator model defines the view columns once — there is no per-application variation in the model itself, only in the filter rules.
- Multiple filter rules per application are combined with AND logic — all rules must pass (Architecture Assumption A13). No OR-combination or complex boolean groupings are required.
- Adoption settings are stored per application as a separate entity, not embedded in the rule set.
- The five known applications and their default rule sets (as documented in AUTOMATED_SOLUTION_ARCHITECTURE.md) serve as initial seed data.
- The numerator filter configuration model-driven pattern (from Epic 006) is the architectural precedent; the denominator model follows the same metadata-driven approach but with a shared (non-per-app) model.
