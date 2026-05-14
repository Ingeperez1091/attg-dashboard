# BQM-US020 — Apply Numerator Filters per Application Config

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-006 (Data Validation & Processing Pipeline)  
> **Priority**: 1 — Critical | **Phase**: Extended-MVP  
> **Last Updated**: 2026-04-16 — aligned with `Documentation/ProjectSpecifications/architecture.md` v1.3.0

---

### :bust_in_silhouette: User Story

**As a** data engineer  
**I want to** have the pipeline apply numerator filter rules from the application's configuration  
**So that** only numerator records matching the configured criteria are included in metric calculations.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** Maestro has numerator filter rules [Region = US, Budget >= 20000], **When** Step 4 of `PL_MetricsProcessing` executes `[app].[usp_ApplyNumeratorFilters]`, **Then** only validated records matching both rules pass through.
- **Given** an application with no numerator filter rules configured, **When** the SP runs, **Then** all validated records pass through unchanged.
- **Given** filter rules are field-operator-value expressions, **When** evaluated, **Then** operators (=, IN, >=, CONTAINS, NOT LIKE, etc.) are applied correctly via dynamic SQL with parameterised inputs.
- **Given** a record fails a numerator filter rule, **When** excluded, **Then** the record is marked 'filtered-out' with the specific `NumeratorFilterRuleId` that rejected it.
- **Given** field names in `app.NumeratorFilterRules` reference `app.ApplicationModels`, **When** the SP builds filter expressions, **Then** it resolves field names via the model's `SourcePath` and `FieldType` definitions.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK076] Implement `[app].[usp_ApplyNumeratorFilters]` stored procedure: accept `@ApplicationId` and `@NumeratorRulesJson` (serialised from Step 1 lookup), evaluate AND-combined field-operator-value expressions against validated-only records from Step 3
- [ ] [BQM-TK077] Implement filter-out tracking: mark excluded records with the specific `NumeratorFilterRuleId` that rejected them in `app.ValidationResults` or a dedicated column in the intermediate result set
- [ ] [BQM-TK078] Write SP integration tests with fixture data: rules applied correctly, no-rule passthrough, operator edge cases (IN with multiple values, CONTAINS with special characters, >= on numeric fields)

### :link: Links

- **Epic:** EPIC-BQM-006 (`Documentation/Backlog/epics/epic-006-validation-processing-pipeline.md`)
- **Architecture:** `Documentation/ProjectSpecifications/architecture.md` v1.3.0 — Section 4.4.3, Step 4 (Apply Numerator Filter Rules)
- **Constitution:** Principle III — validate using application-specific filter rules
- **Sprint:** (Assign via Milestone)

### Business Rules

- Filter rules are AND-combined (all must pass). Empty rule set means "accept all validated records".
- Filter expressions are model-driven: field names resolve through `ApplicationModels`, ensuring new applications require only configuration rows, no code changes.
- All dynamic SQL must use parameterised queries to prevent injection.

### Data Impact & Pipelines

- **Reads:** `app.NumeratorFilterRules` (per app), `app.ApplicationModels` (field definitions), validated numerator records from Step 3
- **Writes:** Updates intermediate result set with filter-out status and rejecting rule reference
