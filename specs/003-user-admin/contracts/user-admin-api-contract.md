# Contract: User Administration API

> Interface contract for `003-user-admin` API surface.  
> All endpoints are under `/api/users`. All requests and responses use JSON.  
> Authorization: administrator role required for all mutating operations.

---

## Authorization Header Pattern

All requests must include a session context. In MVP, determined by the `getSessionUser()`
abstraction. Unauthorized requests return 401 (no session) or 403 (wrong role).

## Scope

Defines request/response contracts for admin-only user management endpoints.

## Security Contract

- All endpoints require authenticated user context.
- All endpoints require role `administrator`.
- Unauthorized outcomes:
  - 401 if unauthenticated.
  - 403 if authenticated but not administrator.

## Endpoints


---

### GET /api/users

List all users with their current role and assigned applications.

**Query Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `includeInactive` | boolean | false | When true, includes deactivated users |

Responses:
- **Response 200**:
```json
{
  "users": [
    {
      "userId": "uuid",
      "username": "string",
      "email": "string",
      "displayName": "string | null",
      "isActive": true,
      "role": {
        "roleId": "uuid",
        "roleName": "administrator | application_owner | viewer"
      },
      "applications": [
        { "applicationId": "uuid", "applicationName": "string" }
      ],
      "createDate": "ISO8601",
      "createdBy": "string"
    }
  ]
}
```
- **Response 401** No active session
- **Response 403**: Authenticated but not administrator
- **Response 500**: Internal Server Error
---

### POST /api/users

Create a new user. Caller must be administrator.

**Request Body**:
```json
{
  "username": "string (required, unique)",
  "email": "string (required, RFC-5322, unique)",
  "displayName": "string (optional)",
  "azureADObjectId": "string (optional)",
  "isActive": true
}
```

Responses:
- **Response 201**:
```json
{
  "userId": "uuid",
  "username": "string",
  "email": "string",
  "displayName": "string | null",
  "azureADObjectId": "string | null",
  "isActive": true,
  "createDate": "ISO8601",
  "createdBy": "string"
}
```
- 400 Bad Request (validation failures)
- **Response 409**: Conflict (duplicate identity/email)
```json
{ "error": "CONFLICT", "details": { "email": "user already exists" } }
``` 
- 500 Internal Server Error
---

### GET /api/users/[userId]

Get a single user with role and application assignments.

Responses:
- **Response 200**: Same shape as single item in the list endpoint  
- **Response 404**: User not found
---

### PUT /api/users/[userId]

Update user identity fields or deactivate. Caller must be administrator.

**Request Body** (all fields optional, at least one required):
```json
{
  "displayName": "string",
  "isActive": false
}
```
Responses:
- **Response 200**: Updated user object (same shape as GET)  
- **Response 400**: Validation error  
- **Response 404**: User not found
---
### PUT /api/users/[userId]/roles

Assign or replace a user's role. Enforces exactly-one-role constraint via upsert.

**Request Body**:
```json
{ "roleId": "uuid (required)" }
```
Responses:
- **Response 200**:
```json
{
  "userId": "uuid",
  "roleId": "uuid",
  "roleName": "administrator | application_owner | viewer",
  "assignedDate": "ISO8601"
}
```

- **Response 400**: Role not found or invalid role value
```json
{ "error": "INVALID_ROLE", "message": "Role must be one of: administrator, application_owner, viewer" }
```
- **Response 404**: Not Found (unknown user)
- **Response 409**: Conflict (self-demotion blocked because no remaining active admins)
---

### GET /api/users/[userId]/applications

List applications assigned to a user.

Responses:
- **Response 200**:
```json
{
  "userId": "uuid",
  "applications": [
    { "applicationId": "uuid", "applicationName": "string", "assignedDate": "ISO8601" }
  ]
}
```
- **Response 404**: Not Found (unknown user)
---

### POST /api/users/[userId]/applications

Assign one, many, or all applications to a user. Duplicate assignments are silently skipped.

**Request Body — specific applications**:
```json
{ "applicationIds": ["uuid", "uuid"] }
```

**Request Body — all applications shortcut**:
```json
{ "all": true }
```

Responses:

- **Response 200**:
```json
{
  "userId": "uuid",
  "assigned": ["uuid", "uuid"],
  "skipped": ["uuid"]
}
```
- **Response 400**: No applicationIds provided and `all` is not true; or unknown applicationId
- **Response 404**: User not found

---


## Error Payload Contract

Standard error object:
- `code` (string, stable machine-readable code)
- `message` (string, user-facing, non-sensitive)
- `requestId` (string, trace identifier)

Example:
```json
{
  "code": "DUPLICATE_IDENTITY_KEY",
  "message": "A user with this identity key already exists.",
  "requestId": "req_01HY..."
}
```

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `UNAUTHORIZED` | 401 | No active session |
| `FORBIDDEN` | 403 | Not an administrator |
| `NOT_FOUND` | 404 | Resource does not exist |
| `VALIDATION_ERROR` | 400 | Input failed schema validation |
| `CONFLICT` | 409 | Duplicate username or email |
| `INVALID_ROLE` | 400 | Role value outside allowed set |
| `INTERNAL_ERROR` | 500 | Unexpected server error (no internal details leaked) |

## Non-Functional Contract

- Mutating operations must populate audit fields (`CreatedBy`/`UpdatedBy`, UTC timestamps).
- No hard delete endpoint is exposed.
- Role and assignment updates are effective on next request.
