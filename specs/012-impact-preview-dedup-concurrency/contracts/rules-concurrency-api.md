# API Contract: Rules Configuration with Concurrency Control

**Endpoints**:
- `GET /api/filters/:scope/:appId` — Load rules with version + active editors
- `PUT /api/filters/:scope/:appId` — Save rules with optimistic concurrency check

**Status**: Modified (adding `configVersion` and `activeEditors` to existing endpoints)

---

## GET /api/filters/:scope/:appId

### Path Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| scope | string | `denominator` or `numerator` |
| appId | UUID | Application ID |

### Response — 200 OK
```json
{
  "applicationId": "uuid-string",
  "applicationName": "Maestro",
  "rules": [
    {
      "ruleId": "uuid-string",
      "applicationId": "uuid-string",
      "denominatorModelId": "uuid-string",
      "fieldName": "EngagementServiceCode",
      "fieldType": "text",
      "operator": "In",
      "value": "11420,11421",
      "ruleOrder": 1
    }
  ],
  "lastUpdatedAt": "2026-06-10T12:00:00.000Z",
  "lastUpdatedBy": "user@example.com",
  "configVersion": 5,
  "activeEditors": [
    {
      "userId": "other-user@example.com",
      "displayName": "Jane Smith",
      "sessionStart": "2026-06-12T14:25:00.000Z"
    }
  ]
}
```

**New fields**:
- `configVersion` (number) — Current version counter from `app.ConfigVersions`. Client MUST include this when saving.
- `activeEditors` (array) — Other users with active edit sessions (excludes the requesting user). Empty array if no other editors.

---

## PUT /api/filters/:scope/:appId

### Request Body (Enhanced)
```json
{
  "rules": [
    {
      "denominatorModelId": "uuid-string",
      "operator": "In",
      "value": "11420,11421"
    }
  ],
  "configVersion": 5
}
```

**New field**:
- `configVersion` (number, required) — The version the client loaded via GET. Server compares against current DB version.

### Response — 200 OK (Save Succeeded)
```json
{
  "applicationId": "uuid-string",
  "applicationName": "Maestro",
  "rules": [...],
  "lastUpdatedAt": "2026-06-12T14:35:00.000Z",
  "lastUpdatedBy": "current-user@example.com",
  "configVersion": 6
}
```

### Response — 409 Conflict (Version Mismatch)
```json
{
  "error": "VERSION_CONFLICT",
  "message": "Configuration was modified by another user since you loaded it.",
  "details": {
    "currentVersion": 6,
    "currentRules": [...],
    "lastModifiedBy": "other-user@example.com",
    "lastModifiedAt": "2026-06-12T14:32:00.000Z"
  }
}
```

### Response — 400 Bad Request
```json
{
  "error": "VALIDATION_ERROR",
  "message": "configVersion is required.",
  "details": {
    "code": "MISSING_CONFIG_VERSION"
  }
}
```

---

## PUT /api/filters/:scope/:appId (Force-Save — Admin Only)

### Request Body
```json
{
  "rules": [...],
  "configVersion": 5,
  "forceOverride": true,
  "overrideReason": "Correcting misconfiguration from batch import."
}
```

**Behavior**:
- Bypasses version check when `forceOverride: true`
- Requires `administrator` role — `application_owner` receives 403
- `overrideReason` is required when `forceOverride: true`
- Audit-logged with `ChangeType = 'ForceOverride'`

### Response — 403 (Non-Admin Force-Save Attempt)
```json
{
  "error": "Forbidden",
  "message": "Force-save is restricted to administrators."
}
```

---

## Authorization
- GET: `viewer`, `application_owner`, `administrator` (read access)
- PUT: `application_owner` (assigned apps) or `administrator`
- PUT with `forceOverride`: `administrator` only
