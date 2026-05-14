# Contract: Authentication and Authorization (EPIC-BQM-005)

## 1. Purpose

Define expected authentication and authorization behavior for protected routes and APIs, including status semantics, role matrix, and application-scope enforcement.

## 2. Session Contract

### Session principal shape

```json
{
  "userId": "uuid",
  "role": "administrator | application_owner | viewer",
  "isActive": true,
  "applications": ["app-id-1", "app-id-2"]
}
```

### Session rules

- Missing session principal => unauthenticated.
- Inactive principal => forbidden.
- Non-admin principal requires application scope for app-scoped resources.

## 3. HTTP Authorization Semantics

### Error contract

- `401 Unauthorized`: caller has no valid authenticated session.
- `403 Forbidden`: caller is authenticated but lacks required role, is inactive, or lacks application scope.
- Responses must not expose internals (stack traces, SQL details, provider internals).

### Protected response examples

```json
{ "error": "UNAUTHORIZED", "message": "No active session." }
```

```json
{ "error": "FORBIDDEN", "message": "Insufficient permissions." }
```

## 4. Role and Capability Matrix

| Capability | administrator | application_owner | viewer |
|------------|---------------|-------------------|--------|
| Access User Administration route/tab | Allow | Deny | Deny |
| Create/update/deactivate users | Allow | Deny | Deny |
| Assign roles/applications | Allow | Deny | Deny |
| View app-scoped data for assigned apps | Allow | Allow | Allow |
| View app-scoped data for unassigned apps | Allow | Deny | Deny |
| Edit filters for assigned apps | Allow | Allow | Deny |
| Edit filters for unassigned apps | Allow | Deny | Deny |
| Trigger validation pipeline for assigned app | Allow | Allow | Deny |

## 5. Application Scope Rules

- `administrator` has global scope (`*`).
- `application_owner` and `viewer` are limited to explicitly assigned app IDs.
- All protected read and write operations using `applicationId` must enforce this scope server-side.

## 6. Route/API Protection Requirements

- Protected route handlers must resolve authenticated principal before business logic execution.
- Route-level protection must prevent restricted page rendering and direct URL bypass.
- API protection must enforce role/scope guards before persistence/query execution.

## 7. Verification Contract

Minimum test expectations:

- Unauthenticated access to protected endpoints returns `401`.
- Authenticated but unauthorized role/scope access returns `403`.
- Admin-only surfaces deny non-admin users.
- Non-admin responses exclude unassigned application data.
- Role/assignment changes are reflected on subsequent authorization checks.
