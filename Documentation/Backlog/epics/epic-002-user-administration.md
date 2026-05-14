# EPIC-BQM-002 — User Administration & RBAC

> **Azure DevOps Work Item Type**: Epic  
> **ADO ID**: _TBD — to be assigned upon creation in Azure DevOps_  
> **ADO Link**: _TBD_  
> **Phase**: MVP

---

## :dart: Objective

Implement the User Administration system including user CRUD operations, role assignment, application assignment, and the admin-only User Administration tab in the dashboard.

## :memo: Description (ADO)

Build the complete user management subsystem: API endpoints for creating users (identity key, email, display name, active state), soft-deleting users, assigning exactly one role per user (administrator, application_owner, viewer), and assigning users to one or many applications (including "All Applications" shortcut). The User Administration tab must be accessible only to administrator users; non-admin users must not access it even via direct route navigation.

## :chart_with_upwards_trend: Business Value

Role-based access control is essential for data security and governance. Administrators need self-service user management to onboard team members and control application-level access without engineering intervention.

## :white_check_mark: Acceptance Criteria

- [ ] Administrators can create users with core identity fields.
- [ ] Administrators can soft-delete (deactivate) users — no hard delete.
- [ ] Exactly one role per user enforced at all times.
- [ ] Administrators can assign users to one or many applications.
- [ ] "All Applications" shortcut grants access to all applications.
- [ ] Duplicate per-user application links prevented.
- [ ] User Administration tab visible and accessible only to `administrator` role.
- [ ] Non-admin direct route navigation to the admin tab is blocked.
- [ ] Role and assignment updates effective for subsequent auth checks.
- [ ] User-administration pull requests pass the baseline CI quality gates (lint, type-check, automated tests).

## :link: Dependencies

- EPIC-BQM-001 (Database Foundation — Users, Roles, UserApplications tables)
- EPIC-BQM-010 (CI Pipeline — baseline CI merged to protected trunk branches before epic source-code tasks begin).

## :classical_building: Architecture & Design Notes

- `Documentation/ProjectSpecifications/architecture.md` — Section 4.1 (Tab Access Matrix), Section 4.2 (API—Users), Section 7 (Security)

## :clipboard: Scope

**In Scope:** User CRUD API; Role assignment API; Application assignment API; User Administration UI tab (admin-only).

**Out of Scope:** Azure AD SSO integration (EPIC-BQM-005); Filter configuration UI (EPIC-BQM-004, EPIC-BQM-008).

## :book: Linked User Stories

- [ ] [BQM-US005] Seed super-admin user
- [ ] [BQM-US006] Admin creates and deactivates users
- [ ] [BQM-US007] Admin assigns roles to users
- [ ] [BQM-US008] Admin assigns applications to users
- [ ] [BQM-US009] User Administration tab UI

## :white_check_mark: Definition of Done (DoD)

- [ ] All linked User Stories are closed.
- [ ] Integration testing completed.

## :page_facing_up: PRD References

- `StakeholderDocuments/ApplicationFeatures.md` — Users Administration Tab
- `.specify/memory/constitution.md` — Principle V (Security & RBAC)
