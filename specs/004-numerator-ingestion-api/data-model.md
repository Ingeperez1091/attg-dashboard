# Phase 1 Data Model: Numerator Data Ingestion API

## 1. Numerator Submission

Represents the inbound request handled by `POST /api/numerator`.

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `applicationId` | UUID string | Yes | Identifies the single in-scope application targeted by the submission |
| `payload` | JSON object or JSON array | Yes | Opaque numerator content supplied by the uploader |

### Validation Rules

- `applicationId` must be a valid UUID.
- `applicationId` must correspond to an active, in-scope application.
- `payload` must be valid JSON.
- `payload` must not be null.
- Empty objects or empty arrays are syntactically valid JSON but should be treated according to the feature's validation rule if the endpoint requires non-empty submission content.

### State Transitions

- `received` → `rejected` when authentication, authorization, or validation fails.
- `received` → `staged` when the submission is successfully persisted in `stage.EngagementUsageRaw`.

## 2. Staged Ingestion Record

Represents the stored raw submission in Azure SQL.

### Source Table

- `stage.EngagementUsageRaw`

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `StageId` | UUID | Yes | Unique identifier for the staged ingestion record |
| `ApplicationId` | UUID | Yes | Foreign key to `app.Applications.ApplicationId` |
| `PayloadJson` | NVARCHAR(MAX) | Yes | Raw JSON payload serialized as submitted |
| `CreateDate` | DATETIME2 | Yes | UTC timestamp when the staging record was created |
| `CreatedBy` | NVARCHAR(255) | Yes | Submitting user identity captured for audit |

### Relationships

- Many staged ingestion records can belong to one application.
- Each staged ingestion record belongs to exactly one application.

### Validation Rules

- `ApplicationId` must reference an existing active row in `app.Applications`.
- `PayloadJson` must contain serializable JSON text.
- `CreatedBy` must capture the authenticated user identity used for audit.

### State Transitions

- `staged` → `processed downstream` outside the scope of this feature.
- `staged` → `failed downstream` outside the scope of this feature.

## 3. Application Access Context

Represents the authorization information used to decide whether a submission is allowed.

### Source Entities

- `SessionUser`
- `app.Applications`
- `app.UserApplications`

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | UUID | Yes | Authenticated user making the request |
| `role` | enum | Yes | One of `administrator`, `application_owner`, `viewer` |
| `applicationId` | UUID | Yes | Requested application target |
| `isApplicationAssigned` | boolean | Conditional | Relevant for `application_owner` authorization |
| `isApplicationActive` | boolean | Yes | Ensures inactive applications are not accepted |

### Authorization Rules

- `administrator`: allowed for any active in-scope application.
- `application_owner`: allowed only when the target application is assigned to the requesting user.
- `viewer`: never allowed to submit numerator data.

## 4. Ingestion Acknowledgment

Represents the success response returned to the caller.

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ingestionId` | UUID string | Yes | Traceable identifier for the staged submission |
| `applicationId` | UUID string | Yes | Target application accepted by the endpoint |
| `submittedAt` | ISO8601 string | Yes | Timestamp associated with staged acceptance |
| `status` | string | Yes | Expected value: `staged` |

### Validation Rules

- `ingestionId` must match the staged record `StageId`.
- `submittedAt` must be a valid UTC/ISO timestamp.
- `status` must be stable and machine-readable for downstream consumers.