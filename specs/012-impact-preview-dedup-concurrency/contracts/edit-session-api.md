# API Contract: Edit Session Lifecycle

**Endpoint**: `POST|PATCH|DELETE /api/filters/:scope/:appId/edit-session`  
**Status**: New

---

## POST /api/filters/:scope/:appId/edit-session — Register Session

Called when a user enters edit mode on a rules configuration form.

### Path Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| scope | string | `denominator` or `numerator` |
| appId | UUID | Application ID |

### Request Body
```json
{}
```
_(No body required — user identity resolved from `Authorization: Bearer <token>` header)_

### Response — 201 Created
```json
{
  "sessionId": "uuid-string",
  "applicationId": "uuid-string",
  "ruleScope": "Denominator",
  "userId": "user@example.com",
  "sessionStart": "2026-06-12T14:25:00.000Z",
  "lastHeartbeat": "2026-06-12T14:25:00.000Z"
}
```

### Response — 403 Forbidden (Viewer role)
```json
{
  "error": "Forbidden",
  "message": "Viewers cannot register edit sessions."
}
```

### Response — 409 Conflict (Session already active)
```json
{
  "error": "SESSION_EXISTS",
  "message": "You already have an active edit session for this configuration.",
  "details": {
    "existingSessionId": "uuid-string"
  }
}
```

---

## PATCH /api/filters/:scope/:appId/edit-session — Heartbeat

Called every 60 seconds by the client to maintain session liveness.

### Request Body
```json
{
  "sessionId": "uuid-string"
}
```

### Response — 200 OK
```json
{
  "sessionId": "uuid-string",
  "lastHeartbeat": "2026-06-12T14:26:00.000Z"
}
```

### Response — 404 Not Found (Session expired or not found)
```json
{
  "error": "NotFound",
  "message": "Edit session not found or has expired."
}
```

---

## DELETE /api/filters/:scope/:appId/edit-session — Release Session

Called when user navigates away, closes the form, or explicitly exits edit mode.

### Request Body
```json
{
  "sessionId": "uuid-string"
}
```

### Response — 204 No Content
_(Session released successfully)_

### Response — 404 Not Found
```json
{
  "error": "NotFound",
  "message": "Edit session not found."
}
```

---

## Session Lifecycle Rules

| Event | Behavior |
|-------|----------|
| User opens edit mode | Client calls POST to register |
| Every 60 seconds | Client calls PATCH with sessionId |
| User saves / navigates away | Client calls DELETE to release |
| Browser crash / tab close | No release sent — server auto-expires after 5 min |
| Session > 5 min without heartbeat | Treated as stale; excluded from `activeEditors` |
| Stale session cleanup | Performed on-access when querying active editors |

## Authorization
- POST: `application_owner` (assigned apps) or `administrator`
- PATCH: Session owner only (userId must match)
- DELETE: Session owner only (userId must match)
- Viewers cannot register sessions (POST returns 403)
