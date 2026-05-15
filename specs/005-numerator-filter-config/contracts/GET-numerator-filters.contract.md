# API Contract: GET /api/filters/numerator/:appId

**Endpoint**: `GET /api/filters/numerator/:appId`  
**Purpose**: Retrieve current numerator filter rules for an application  
**Status**: Draft — Phase 1  

---

## Request

### Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| appId | string (uuid) | Yes | Application ID |

### Query Parameters

None.

### Headers

| Name | Value | Required |
|------|-------|----------|
| Authorization | Bearer {JWT-token} | Yes |

### Body

None.

---

## Response (Success)

### Status Code

`200 OK`

### Headers

```
Content-Type: application/json
```

### Body Schema (Zod)

```typescript
const FilterRuleResponseSchema = z.object({
  ruleId: z.string().uuid(),
  applicationModelFieldId: z.string().uuid(),
  fieldName: z.string(), // Human-readable field name from ApplicationModelFields
  fieldType: z.enum(['text', 'numeric', 'boolean', 'date']),
  operator: z.string(),
  value: z.string(),
  ruleOrder: z.number().int().positive(),
  createdBy: z.string().optional(),
  updatedBy: z.string().optional(),
});

const GetFiltersResponseSchema = z.object({
  applicationId: z.string().uuid(),
  applicationName: z.string(),
  rules: z.array(FilterRuleResponseSchema),
  lastUpdatedAt: z.string().datetime(),
  lastUpdatedBy: z.string(),
});
```

### Example Response

```json
{
  "applicationId": "10000000-0000-0000-0000-000000000005",
  "applicationName": "Navigate",
  "rules": [
    {
      "ruleId": "30000000-0000-0000-0000-000000000101",
      "applicationModelFieldId": "20000000-0000-0000-0000-000000000101",
      "fieldName": "RevenueFYTD",
      "fieldType": "numeric",
      "operator": "GREATER_THAN",
      "value": "50000",
      "ruleOrder": 1,
      "createdBy": "domain\\owner.user",
      "updatedBy": "domain\\owner.user"
    },
    {
      "ruleId": "30000000-0000-0000-0000-000000000102",
      "applicationModelFieldId": "20000000-0000-0000-0000-000000000102",
      "fieldName": "NavigateStatus",
      "fieldType": "text",
      "operator": "EQUALS",
      "value": "Active",
      "ruleOrder": 2,
      "createdBy": "domain\\owner.user",
      "updatedBy": "domain\\owner.user"
    }
  ],
  "lastUpdatedAt": "2026-05-04T12:00:00Z",
  "lastUpdatedBy": "domain\\owner.user"
}
```

---

## Response (Empty Rule Set)

### Status Code

`200 OK`

### Body

```json
{
  "applicationId": "10000000-0000-0000-0000-000000000005",
  "applicationName": "Navigate",
  "rules": [],
  "lastUpdatedAt": "2026-05-04T12:00:00Z",
  "lastUpdatedBy": "domain\\owner.user"
}
```

---

## Error Responses

### 401 Unauthorized

**Condition**: No Authorization header or invalid JWT token.

```json
{
  "error": "Unauthorized",
  "message": "Missing or invalid authorization token"
}
```

### 403 Forbidden

**Condition**: Authenticated user is not an administrator and not assigned to the requested application.

```json
{
  "error": "Forbidden",
  "message": "You do not have access to this application"
}
```

### 404 Not Found

**Condition**: Application ID does not exist or is inactive.

```json
{
  "error": "NotFound",
  "message": "Application not found"
}
```

### 500 Internal Server Error

**Condition**: Unexpected database or server error.

```json
{
  "error": "InternalServerError",
  "message": "An unexpected error occurred. Please contact support."
}
```

---

## Authorization Model

- **Administrator**: Can access rules for all applications
- **Application Owner**: Can access rules only for applications assigned to them in `app.UserApplications`
- **Viewer**: Can access rules only for applications assigned to them in read-only mode
- **Unauthenticated**: 401 Unauthorized

---

## Implementation Notes

1. **Authorization Middleware**: Inspect JWT token → determine user role and assigned applications → verify appId matches assignments
2. **Query Pattern**:
   ```sql
   SELECT 
     nfr.RuleId,
     nfr.ApplicationId,
     nfr.ApplicationModelFieldId,
     amf.FieldName,
     amf.FieldType,
     nfr.Operator,
     nfr.Value,
     nfr.RuleOrder
   FROM app.NumeratorFilterRules nfr
   JOIN app.ApplicationModelFields amf ON nfr.ApplicationModelFieldId = amf.ApplicationModelFieldId
   WHERE nfr.ApplicationId = @appId
     AND nfr.IsActive = 1
   ORDER BY nfr.RuleOrder ASC
   ```
3. **Caching**: No caching required (data is user-configurable; invalidation logic would be complex)
4. **Performance Target**: p95 latency <= 3 seconds for retrieval and update operations under normal load
5. **Repository Implementation**: Both in-memory and SQL repositories must return rules sorted by RuleOrder ascending
