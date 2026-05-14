# Contract: Admin UI Access and Route Protection
> Frontend interface contract for the admin-only User Administration tab.

## Scope

Defines visibility and route-access guarantees for the User Administration tab.

## Navigation Visibility Rules

- If role is `administrator`:
  - Show "User Administration" tab in dashboard navigation.
- If role is `application_owner` or `viewer`:
  - Hide "User Administration" tab.

## Route Protection Rules

Protected route: `/admin/users`

- Unauthenticated user -> redirect to sign-in or return unauthorized state.
- Authenticated non-admin user -> redirect to home/dashboard and do not render admin content.
- Authenticated administrator -> allow route and render user management UI.

## UI Capability Matrix

- `administrator`:
  - Can create users
  - Can assign role
  - Can assign applications
  - Can deactivate/reactivate users
- `application_owner`:
  - Cannot access admin route or controls
- `viewer`:
  - Cannot access admin route or controls

---

## Route

`/admin/users`

---

## Access Rules

| User Role | Tab Visible in Nav | Direct Route Access |
|-----------|-------------------|---------------------|
| `administrator` | Yes | Yes |
| `application_owner` | No | Redirected to `/` |
| `viewer` | No | Redirected to `/` |
| Unauthenticated | No | Redirected to sign-in |

Route protection is enforced at two layers:
1. Middleware (`middleware.ts`) — server-side redirect before page renders
2. `AdminLayout` component — client-side guard for defense in depth

---

## Views

### User List View

Displayed on initial tab load.

**Columns**:
| Column | Source |
|--------|--------|
| Display Name / Username | `users[].displayName ?? users[].username` |
| Email | `users[].email` |
| Role | `users[].role.roleName` |
| Status | `users[].isActive` — "Active" / "Inactive" |
| Applications | Count or comma-separated names |
| Actions | Edit, Deactivate |

**Behaviors**:
- Default: shows active users only
- Toggle to include inactive users (maps to `?includeInactive=true`)
- Row click or Edit button opens Edit User panel

---

### Create User Form

Triggered by "Create User" button. Inline panel or modal.

**Fields**:
| Field | Required | Validation |
|-------|----------|------------|
| Username (Identity Key) | Yes | Non-empty, unique |
| Email | Yes | Valid email, unique |
| Display Name | No | Max 255 chars |
| Role | Yes | Dropdown: administrator / application_owner / viewer |
| Applications | No | Multi-select list; includes "All Applications" toggle |

**On Submit**:
1. `POST /api/users` → create user
2. `PUT /api/users/[id]/roles` → assign role
3. `POST /api/users/[id]/applications` → assign applications
4. Refresh user list on success

**Error Handling**: Display field-level validation errors. Show generic "Failed to save user" banner on server error.

---

### Edit User Panel

**Fields** (pre-populated):
| Field | Editable |
|-------|----------|
| Username | No (identity key, read-only after creation) |
| Email | Yes |
| Display Name | Yes |
| Role | Yes — dropdown |
| Applications | Yes — multi-select, includes "All Applications" toggle |
| Active State | Yes — toggle (deactivate/reactivate) |

**On Save**: `PUT /api/users/[id]` + role/application assignment endpoints as needed.

---

## Component Tree

```
AdminLayout (role guard + redirect)
└── UsersPage
    ├── UserListHeader (Create User button, inactive toggle)
    ├── UserListTable (Motif data-table WC)
    │   └── UserRow (per user)
    └── UserFormPanel (create or edit)
        ├── IdentityFields
        ├── RolePicker (Motif select WC)
        └── ApplicationPicker (Motif multi-select WC, All Applications toggle)
```

---

## UI Standards

- Motif Web Components for all form controls and tables
- Tab navigation uses Motif tab component
- Error and success states use Motif notification/alert components
- Loading states shown on async operations (create, save, deactivate)


## UX Error Behavior

- Direct route access by non-admin must show user-friendly unauthorized message or safe redirect.
- Unauthorized UI states must not expose sensitive user records or internal error traces.

## Acceptance Contract

The following must be testable in integration tests:
1. Admin sees tab and route content.
2. Viewer/application_owner does not see tab.
3. Viewer/application_owner direct route access is blocked.
4. Admin actions in tab trigger matching API calls and success/error feedback.
