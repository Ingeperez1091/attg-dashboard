# API Contract: PUT /api/filters/numerator/:appId

**Endpoint**: `PUT /api/filters/numerator/:appId`  
**Purpose**: Update numerator filter rules for an application  
**Status**: Draft — Phase 1

---

## Request

### Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| appId | string (uuid) | Yes | Application ID |

### Headers

| Name | Value | Required |
|------|-------|----------|
| Authorization | Bearer {JWT-token} | Yes |
| Content-Type | application/json | Yes |

### Body Schema (Zod)

```typescript
const UpdateFilterRuleRequestSchema = z.object({
  applicationModelFieldId: z.string().uuid(),
  operator: z.string(),
  value: z.string(),
});

const UpdateFiltersRequestSchema = z.object({
  rules: z.array(UpdateFilterRuleRequestSchema),
});
```

### Example Request

```json
{
  "rules": [
    {
      "applicationModelFieldId": "20000000-0000-0000-0000-000000000101",
      "operator": "GREATER_THAN",
      "value": "50000"
    },
    {
      "applicationModelFieldId": "20000000-0000-0000-0000-000000000102",
      "operator": "EQUALS",
      "value": "Active"
    }
  ]
}
```

### Validation Constraints

- **Empty array** (clearing all rules): Allowed; no validation error
- **Field uniqueness**: Multiple rules on same field with different operators allowed (AND-combined)
- **Duplicate rules** (same FieldId + Operator + Value): Allowed but redundant; system silently deduplicates
- **RuleOrder**: System assigns automatically based on request order (1, 2, 3, ...)
- **All fields must be filterable**: If any field has `IsFilterable = 0`, return 400 with field identification
- **All operators must be valid for field type**: If operator not in type's allowed set, return 400 with suggestion

---

## Response (Success)

### Status Code

`200 OK`

### Headers

```
Content-Type: application/json
```

### Body Schema

Same as GET /api/filters/numerator/:appId — returns full updated rule set.

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
      "ruleOrder": 1
    },
    {
      "ruleId": "30000000-0000-0000-0000-000000000102",
      "applicationModelFieldId": "20000000-0000-0000-0000-000000000102",
      "fieldName": "NavigateStatus",
      "fieldType": "text",
      "operator": "EQUALS",
      "value": "Active",
      "ruleOrder": 2
    }
  ],
  "lastUpdatedAt": "2026-05-04T12:00:00Z",
  "lastUpdatedBy": "domain\\owner.user"
}
```

---

## Error Responses

### 400 Bad Request

**Condition**: Request body invalid or rule validation fails.

**Subcases**:

**Field not found**:
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Field ID 20000000-0000-0000-0000-000000009999 not found for this application",
  "details": {
    "code": "FIELD_NOT_FOUND",
    "fieldId": "20000000-0000-0000-0000-000000009999"
  }
}
```

**Field not filterable**:
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Field 'EngagementId' is not marked as filterable",
  "details": {
    "code": "FIELD_NOT_FILTERABLE",
    "fieldId": "20000000-0000-0000-0000-000000000103"
  }
}
```

**Invalid operator for field type**:
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Operator 'CONTAINS' not valid for field type 'numeric'. Valid operators: EQUALS, NOT_EQUALS, GREATER_THAN, GREATER_OR_EQUAL, LESS_THAN, LESS_OR_EQUAL",
  "details": {
    "code": "INVALID_OPERATOR",
    "fieldId": "20000000-0000-0000-0000-000000000101",
    "fieldType": "numeric",
    "operator": "CONTAINS",
    "validOperators": "EQUALS,NOT_EQUALS,GREATER_THAN,GREATER_OR_EQUAL,LESS_THAN,LESS_OR_EQUAL"
  }
}
```

**Invalid value format**:
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Value 'abc' is not a valid number for numeric field",
  "details": {
    "code": "INVALID_VALUE_FORMAT",
    "fieldId": "20000000-0000-0000-0000-000000000101",
    "fieldType": "numeric",
    "value": "abc"
  }
}
```

**Invalid request body structure** (e.g., missing required field):
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Missing required field: 'operator'",
  "details": {
    "code": "MISSING_REQUIRED_FIELD"
  }
}
```

### 401 Unauthorized

**Condition**: No Authorization header or invalid JWT token.

```json
{
  "error": "Unauthorized",
  "message": "Missing or invalid authorization token"
}
```

### 403 Forbidden

**Condition**: Authenticated user is not an administrator and not assigned to the requested application, OR user is assigned but not an administrator or application_owner (e.g., is a viewer).

```json
{
  "error": "Forbidden",
  "message": "You do not have permission to edit rules for this application"
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

### 409 Conflict

**Condition**: Concurrent update detected (optional, for optimistic locking if implemented).

```json
{
  "error": "Conflict",
  "message": "Rules for this application have been modified since you last retrieved them. Please refresh and try again.",
  "code": "CONCURRENT_MODIFICATION"
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

- **Administrator**: Can edit rules for all applications
- **Application Owner**: Can edit rules only for applications assigned to them in `app.UserApplications`
- **Viewer**: Cannot edit (403 Forbidden)
- **Unauthenticated**: 401 Unauthorized

---

## Side Effects (if 200 OK)

1. **Database mutation**: All prior active rules for this application are soft-deleted (`IsActive = 0`) and replaced with new active rules (`IsActive = 1`)
2. **Audit logging**:
   - UpdateDate and UpdatedBy columns on NumeratorFilterRules are updated
  - Prior rule set is saved to app.RuleChangeAudit with snapshot of rules before and after this change
3. **No notifications**: No email or in-app notifications are sent (out of scope)

---

## Implementation Notes

1. **Atomic update**: Use SQL transaction to ensure either all soft-delete and insert actions are committed or none (prevent partial updates)
2. **Authorization first**: Check role + assignment BEFORE reading request body (fail fast)
3. **Validation order**:
   - Validate request body structure (Zod)
  - Validate each rule individually (field exists, filterable, operator valid)
   - Validate rule set integrity (no cross-app references)
   - Atomic DB write (soft-delete old active rows, insert new active rows in transaction)
4. **Query pattern** (simplified):
   ```sql
   BEGIN TRANSACTION
     UPDATE app.NumeratorFilterRules
        SET IsActive = 0,
            UpdateDate = SYSUTCDATETIME(),
            UpdatedBy = SUSER_SNAME()
      WHERE ApplicationId = @appId
        AND IsActive = 1

     INSERT INTO app.NumeratorFilterRules (ApplicationId, ApplicationModelFieldId, Operator, Value, RuleOrder, IsActive, CreateDate, CreatedBy, UpdateDate, UpdatedBy)
         VALUES (@appId, @fieldId1, @op1, @val1, 1, 1, SYSUTCDATETIME(), SUSER_SNAME(), SYSUTCDATETIME(), SUSER_SNAME())
           (@appId, @fieldId2, @op2, @val2, 2, 1, SYSUTCDATETIME(), SUSER_SNAME(), SYSUTCDATETIME(), SUSER_SNAME())
           ...
   COMMIT
   ```
5. **Idempotency**: Submitting the same rule set twice is safe (overwrites with identical data; no error)
6. **Performance target**: p95 latency < 2 seconds for typical rule sets
7. **Repository implementation**: Both in-memory and SQL repositories must support atomic replacement
