# API Contract: GET /api/applications/:appId/numeratormodel

**Endpoint**: `GET /api/applications/:appId/numeratormodel`  
**Purpose**: Retrieve application model field definitions for filter UI population  
**Status**: Draft — Phase 1

---

## Request

### Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| appId | string (uuid) | Yes | Application ID to retrieve numerator model fields for |

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
const ApplicationModelFieldResponseSchema = z.object({
  applicationModelFieldId: z.string().uuid(),
  fieldName: z.string(),
  fieldType: z.enum(['text', 'numeric', 'boolean', 'date']),
  isFilterable: z.boolean(),
  isMetricDimension: z.boolean(),
  displayOrder: z.number().int().nonnegative(),
});

const GetApplicationModelsResponseSchema = z.object({
  applicationId: z.string().uuid(),
  applicationName: z.string(),
  fields: z.array(ApplicationModelFieldResponseSchema),
});
```

### Example Response (for Navigate application)

```json
{
  "applicationId": "10000000-0000-0000-0000-000000000005",
  "applicationName": "Navigate",
  "fields": [
    {
      "applicationModelFieldId": "20000000-0000-0000-0000-000000000101",
      "fieldName": "RevenueFYTD",
      "fieldType": "numeric",
      "isFilterable": true,
      "isMetricDimension": true,
      "displayOrder": 1
    },
    {
      "applicationModelFieldId": "20000000-0000-0000-0000-000000000102",
      "fieldName": "NavigateStatus",
      "fieldType": "text",
      "isFilterable": true,
      "isMetricDimension": false,
      "displayOrder": 2
    },
    {
      "applicationModelFieldId": "20000000-0000-0000-0000-000000000103",
      "fieldName": "EngagementId",
      "fieldType": "text",
      "isFilterable": false,
      "isMetricDimension": false,
      "displayOrder": 3
    }
  ]
}
```

---

## Response (No Fields Configured)

### Status Code

`200 OK`

### Body

```json
{
  "applicationId": "10000000-0000-0000-0000-000000000005",
  "applicationName": "Navigate",
  "fields": []
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

**Condition**: Authenticated user is not assigned to the requested application and is not an administrator.

```json
{
  "error": "Forbidden",
  "message": "You do not have access to this application"
}
```

### 404 Not Found

**Condition**: Application does not exist or is inactive.

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

- **Administrator**: Returns fields for any valid application
- **Application Owner**: Returns fields only for assigned applications
- **Viewer**: Returns fields only for assigned applications
- **Unauthenticated**: 401 Unauthorized

---

## Filtering Behavior

### Fields Returned

- All fields in `app.ApplicationModelFields` for the requested application where `IsActive = 1`
- **Rationale**: The filter editor must receive the full active field catalog and disable non-filterable options where `isFilterable = false`.

### Future Design Note

- A future Application Models management design should introduce dedicated endpoints/UI for maintaining the full field catalog and lifecycle operations.

### Sorting

- Results sorted by `DisplayOrder` ascending
- Within same DisplayOrder, sort by ApplicationModelFieldId ascending

---

## Use Cases

### Use Case 1: Populate Filter Field Selector

When user opens filter rule editor for Navigate:

```bash
GET /api/applications/10000000-0000-0000-0000-000000000005/numeratormodel
```

Response includes model metadata for the application. UI filters to `isFilterable: true` options in the selector. User selects "RevenueFYTD" (`applicationModelFieldId=20000000-0000-0000-0000-000000000101`).

The UI MUST render options with `isFilterable: false` as disabled and prevent rule creation with those fields.

### Use Case 2: Show Why Field Is Not Filterable

Response includes `applicationModelFieldId=20000000-0000-0000-0000-000000000103` (EngagementId) with `isFilterable: false`. UI shows disabled option with tooltip: "EngagementId is not available for filtering in this application."

### Use Case 3: Populate Type-Aware Operator Dropdown

After user selects RevenueFYTD (fieldType=numeric), UI queries the response to find that field's `fieldType: "numeric"`. UI renders only numeric operators: EQUALS, NOT_EQUALS, GREATER_THAN, GREATER_OR_EQUAL, LESS_THAN, LESS_OR_EQUAL.

---

## Implementation Notes

1. **Caching**: Safe to cache in browser (localStorage or in-memory) with 1-hour TTL. Cache invalidation not critical since field definitions change infrequently.
2. **Query pattern**:
   ```sql
   SELECT 
     ApplicationModelFieldId,
     ApplicationId,
     FieldName,
     FieldType,
     IsFilterable,
     IsMetricDimension,
     DisplayOrder
   FROM app.ApplicationModelFields
  WHERE ApplicationId = @appId
    AND IsActive = 1
   ORDER BY DisplayOrder ASC, ApplicationModelFieldId ASC
   ```

3. **Performance**: p95 latency < 500ms (fields table << 1000 rows total)
4. **Repository implementation**:
   - In-memory: Filter in-memory list by applicationId
   - SQL: Execute parameterized query above
5. **No mutation**: GET-only endpoint; no side effects
