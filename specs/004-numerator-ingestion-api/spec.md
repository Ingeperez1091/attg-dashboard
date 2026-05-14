# Feature Specification: Numerator Data Ingestion API

**Feature Branch**: `[004-numerator-ingestion-api]`  
**Created**: 2026-04-15  
**Status**: Ready  
**Input**: User description: "epic-003-numerator-ingestion-api"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Submit Numerator Data Quickly (Priority: P1)

As an authorized uploader, I want to submit numerator data for a single application in one request so that new adoption data is captured immediately without waiting for downstream processing to finish.

**Why this priority**: This is the core business capability for the epic. Without a working ingestion entry point, numerator data cannot enter the platform and no downstream adoption metrics can be produced.

**Independent Test**: Can be fully tested by sending a valid submission for one in-scope application and confirming the system accepts it, records the submission, and returns an acknowledgment without waiting for validation or metric recalculation.

**Acceptance Scenarios**:

1. **Given** an authenticated user with permission to submit data for an application, **When** they send a valid numerator JSON payload for that application, **Then** the system stores the submission as a new staged ingestion record and returns a success acknowledgment.
2. **Given** a valid submission is accepted, **When** the acknowledgment is returned, **Then** it includes enough information for the submitter to know the request was received and can be traced later.
3. **Given** downstream validation or metric recalculation has not yet started or is delayed, **When** a valid submission is stored, **Then** the ingestion request still succeeds because downstream processing is asynchronous.

---

### User Story 2 - Reject Bad or Unauthorized Submissions Clearly (Priority: P2)

As an uploader or administrator, I want invalid or unauthorized submissions to fail immediately with clear feedback so that incorrect data is not staged and the issue can be corrected quickly.

**Why this priority**: Fast rejection prevents polluted staging data, reduces rework, and enforces the security and data integrity rules defined by the constitution.

**Independent Test**: Can be tested by submitting malformed payloads, missing required fields, unsupported application identifiers, and requests from users without permission, then confirming the system rejects them with the appropriate response and no staged record is created.

**Acceptance Scenarios**:

1. **Given** a request is missing required submission data, **When** the request is sent, **Then** the system rejects it with a client-error response that explains what is missing or malformed.
2. **Given** a user is not authenticated, **When** they attempt to submit numerator data, **Then** the system rejects the request before any data is accepted.
3. **Given** a user is authenticated but does not have permission for the requested application, **When** they submit numerator data, **Then** the system rejects the request before any data is accepted.
4. **Given** an unexpected server-side failure occurs while handling the request, **When** the submission cannot be stored, **Then** the system returns a generic failure message without exposing internal details.

---

### User Story 3 - Preserve Auditability for Each Accepted Submission (Priority: P3)

As an administrator or downstream operator, I want each accepted numerator submission to retain its original payload and upload metadata so that the source, timing, and ownership of the data can be audited later.

**Why this priority**: The broader dashboard depends on traceable numerator records for validation, investigation, and reproducibility of reported adoption metrics.

**Independent Test**: Can be tested by accepting a submission and verifying the stored record preserves the original payload alongside the submitting user, target application, and submission timestamp.

**Acceptance Scenarios**:

1. **Given** a valid submission is accepted, **When** the staged record is reviewed, **Then** the original payload is preserved without business-rule transformation.
2. **Given** a valid submission is accepted, **When** the staged record is reviewed, **Then** it shows who submitted it, for which application, and when it was received.

### Edge Cases

- A request contains valid JSON but the data collection is empty.
- A request targets an unknown or inactive application.
- A user resubmits the same payload more than once; each accepted submission must remain independently traceable.
- A payload contains unexpected fields, special characters, or large text values that must be treated as data rather than executable content.
- Downstream processing is unavailable at submission time; accepted ingestion must still succeed because storage and processing are decoupled.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow only authenticated users to submit numerator data.
- **FR-002**: The system MUST accept numerator submissions in JSON format for exactly one in-scope application per request.
- **FR-003**: The system MUST verify that the target application is one of the supported applications before accepting a submission.
- **FR-004**: The system MUST enforce authorization so administrators can submit for any in-scope application, application owners can submit only for their assigned applications, and viewers cannot submit numerator data.
- **FR-005**: The system MUST reject malformed, incomplete, or unsupported submissions before creating a staged ingestion record.
- **FR-006**: The system MUST preserve the accepted payload in its original submitted form for later downstream processing and audit review.
- **FR-007**: The system MUST record upload metadata for each accepted submission, including the submitting user, target application, and submission timestamp.
- **FR-008**: The system MUST return an acknowledgment for each accepted submission that confirms receipt and provides a traceable ingestion reference.
- **FR-009**: The system MUST not block the request on denominator matching, numerator filtering, duplicate validation, or metric calculation.
- **FR-010**: The system MUST protect the ingestion path from injection-style input by treating payload values strictly as data.
- **FR-011**: The system MUST return clear client-error responses for invalid requests and clear authorization responses for unauthenticated or unauthorized requests.
- **FR-012**: The system MUST return a generic failure message when an unexpected server-side error prevents the submission from being staged.
- **FR-013**: The system MUST support numerator submissions for Maestro, EYST, Prodigy, Vector, and Navigate.

### Key Entities *(include if feature involves data)*

- **Numerator Submission**: A single user-initiated request that identifies one target application and carries the numerator data to be ingested.
- **Staged Ingestion Record**: The stored representation of an accepted submission, including the original payload and audit metadata used by downstream processing.
- **Application Access Context**: The combination of the submitting user's role and application assignments that determines whether a submission is allowed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of valid numerator submissions receive an acknowledgment within 5 seconds under normal operating conditions.
- **SC-002**: 100% of accepted submissions retain a retrievable original payload together with submitting user, application, and submission timestamp.
- **SC-003**: 100% of unauthenticated or unauthorized submission attempts are rejected before any staged ingestion record is created.
- **SC-004**: 100% of malformed or incomplete submissions receive a client-error response and create no staged ingestion record.
- **SC-005**: 100% of accepted submissions remain available for downstream asynchronous processing without requiring the submitter to wait for validation or metric calculation to finish.

## Assumptions

- JSON is the only supported numerator submission format for this MVP slice; spreadsheet upload and file parsing are out of scope.
- Each submission targets one application at a time rather than bundling multiple applications into a single request.
- Authorized submitters are administrators and application owners with access to the target application; viewers are excluded from numerator submission.
- Validation against denominator records, duplicate detection, business-rule filtering, and metric calculation happen after ingestion in a separate workflow.
- The set of supported applications for this feature remains the current five in-scope applications during MVP delivery.
