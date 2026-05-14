# User Administration API

Base path: /api/admin/users

## Authentication and authorization

- All endpoints are wrapped by administrator guard middleware.
- Caller resolution order:
  - Authorization: Bearer <userId>
  - DEV_SESSION_USER_ID (non-production fallback)
- In non-production, when Authorization is missing and DEV_SESSION_USER_ID is set, the session resolves as seeded administrator.
- Standard authorization outcomes:
  - 401: no active session
  - 403: authenticated but not administrator or forbidden action

## Error payload shape

```json
{
  "code": "STRING_CODE",
  "message": "Human readable message",
  "requestId": "trace-id"
}
```

Common error codes: VALIDATION_ERROR, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, INTERNAL_ERROR.

## Role enum

roleId values:

- administrator
- application_owner
- viewer

## Endpoints

### GET /api/admin/users

Description: List users.

Query parameters:

- includeInactive: boolean, default false

Success response: 200

```json
{
  "users": [
    {
      "userId": "mem-user-1",
      "username": "owner_user",
      "email": "owner@example.com",
      "displayName": "Owner User",
      "azureAdObjectId": null,
      "role": "viewer",
      "applicationIds": [],
      "isActive": true,
      "createDate": "2026-04-30T11:00:00.000Z",
      "createdBy": "30000000-0000-0000-0000-000000000001",
      "updateDate": "2026-04-30T11:00:00.000Z",
      "updatedBy": "30000000-0000-0000-0000-000000000001"
    }
  ]
}
```

### POST /api/admin/users

Description: Create user and optionally assign role/applications.

Request body:

```json
{
  "username": "new_user",
  "email": "new-user@example.com",
  "displayName": "New User",
  "azureADObjectId": "optional-object-id",
  "isActive": true,
  "roleId": "application_owner",
  "applicationIds": ["10000000-0000-0000-0000-000000000001"]
}
```

Notes:

- roleId is optional.
- applicationIds is optional and must be UUID values.

Success response: 201

```json
{
  "userId": "mem-user-2",
  "username": "new_user",
  "email": "new-user@example.com",
  "displayName": "New User",
  "azureAdObjectId": "optional-object-id",
  "role": "application_owner",
  "applicationIds": ["10000000-0000-0000-0000-000000000001"],
  "isActive": true,
  "createDate": "2026-04-30T11:00:00.000Z",
  "createdBy": "30000000-0000-0000-0000-000000000001",
  "updateDate": "2026-04-30T11:00:00.000Z",
  "updatedBy": "30000000-0000-0000-0000-000000000001"
}
```

### GET /api/admin/users/{userId}

Description: Retrieve one user.

Success response: 200

```json
{
  "userId": "mem-user-2",
  "username": "new_user",
  "email": "new-user@example.com",
  "displayName": "New User",
  "azureAdObjectId": "optional-object-id",
  "role": "application_owner",
  "applicationIds": ["10000000-0000-0000-0000-000000000001"],
  "isActive": true,
  "createDate": "2026-04-30T11:00:00.000Z",
  "createdBy": "30000000-0000-0000-0000-000000000001",
  "updateDate": "2026-04-30T11:00:00.000Z",
  "updatedBy": "30000000-0000-0000-0000-000000000001"
}
```

### PUT /api/admin/users/{userId}

Description: Update active status, effective role, and full application associations in one call.

Request body:

```json
{
  "roleId": "viewer",
  "isActive": true,
  "applicationIds": ["10000000-0000-0000-0000-000000000001"]
}
```

Success response: 200

```json
{
  "userId": "mem-user-2",
  "username": "new_user",
  "email": "new-user@example.com",
  "displayName": "New User",
  "azureAdObjectId": "optional-object-id",
  "role": "viewer",
  "applicationIds": ["10000000-0000-0000-0000-000000000001"],
  "isActive": true,
  "createDate": "2026-04-30T11:00:00.000Z",
  "createdBy": "30000000-0000-0000-0000-000000000001",
  "updateDate": "2026-04-30T11:05:00.000Z",
  "updatedBy": "30000000-0000-0000-0000-000000000001"
}
```

### PUT /api/admin/users/{userId}/role

Description: Assign/replace effective role.

Request body:

```json
{
  "roleId": "application_owner"
}
```

Success response: 200

```json
{
  "userId": "mem-user-2",
  "roleId": "application_owner"
}
```

### GET /api/admin/users/{userId}/applications

Description: List user application assignments.

Success response: 200

```json
{
  "userId": "mem-user-2",
  "applications": [
    "10000000-0000-0000-0000-000000000001",
    "*"
  ]
}
```

### POST /api/admin/users/{userId}/applications

Description: Assign one app or all apps.

Request body (single app):

```json
{
  "applicationId": "10000000-0000-0000-0000-000000000001"
}
```

Request body (all apps):

```json
{
  "all": true
}
```

Validation rule: provide either applicationId or all=true, but not both.

Success response: 201

```json
{
  "userId": "mem-user-2",
  "assigned": [
    "*"
  ]
}
```

### DELETE /api/admin/users/{userId}/applications/{applicationId}

Description: Remove one explicit application assignment.

Success response: 204

Special rule:

- applicationId = * is blocked and returns 403.

### PUT /api/admin/users/{userId}/active

Description: Toggle active status with last-administrator safeguard.

Request body:

```json
{
  "isActive": false
}
```

Success response: 200

```json
{
  "userId": "mem-user-2",
  "username": "new_user",
  "email": "new-user@example.com",
  "displayName": "New User",
  "azureAdObjectId": null,
  "role": "application_owner",
  "applicationIds": ["10000000-0000-0000-0000-000000000001"],
  "isActive": false,
  "createDate": "2026-04-30T11:00:00.000Z",
  "createdBy": "30000000-0000-0000-0000-000000000001",
  "updateDate": "2026-04-30T11:05:00.000Z",
  "updatedBy": "30000000-0000-0000-0000-000000000001"
}
```

Conflict behavior:

- Returns 409 CONFLICT when attempting to deactivate the last active administrator.

## Curl examples

```bash
curl "http://localhost:3000/api/admin/users?includeInactive=true"

curl -X POST "http://localhost:3000/api/admin/users" \
  -H "Content-Type: application/json" \
  -d '{"username":"new_user","email":"new-user@example.com","isActive":true,"roleId":"application_owner","applicationIds":["10000000-0000-0000-0000-000000000001"]}'

curl -X PUT "http://localhost:3000/api/admin/users/mem-user-2" \
  -H "Content-Type: application/json" \
  -d '{"roleId":"viewer","isActive":true,"applicationIds":["10000000-0000-0000-0000-000000000001"]}'

curl -X PUT "http://localhost:3000/api/admin/users/mem-user-2/role" \
  -H "Content-Type: application/json" \
  -d '{"roleId":"application_owner"}'

curl -X POST "http://localhost:3000/api/admin/users/mem-user-2/applications" \
  -H "Content-Type: application/json" \
  -d '{"all":true}'

curl -X PUT "http://localhost:3000/api/admin/users/mem-user-2/active" \
  -H "Content-Type: application/json" \
  -d '{"isActive":false}'
```
