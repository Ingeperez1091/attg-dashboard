# EPIC-BQM-005 — Authentication & Authorization (Azure AD)

> **Azure DevOps Work Item Type**: Epic  
> **ADO ID**: _TBD — to be assigned upon creation in Azure DevOps_  
> **ADO Link**: _TBD_  
> **Phase**: Extended-MVP

---

## :dart: Objective

Enforce Azure AD SSO for authentication and implement role-based authorization to gate all operations according to the three defined roles: administrator, application_owner, viewer.

## :memo: Description (ADO)

Integrate Azure AD SSO so the dashboard requires authenticated sessions. Implement authorization middleware that enforces role-based access: administrators access all features and applications; application owners view and edit filter controls for assigned applications only; viewers have read-only access to assigned applications only. Anonymous access is prohibited. All API endpoints must validate authorization and return 401/403 without leaking internal details.

## :chart_with_upwards_trend: Business Value

Security and compliance require authenticated, role-gated access to sensitive engagement and revenue data. Azure AD SSO provides seamless enterprise login and role-based authorization ensures users only see and modify data within their scope.

## :white_check_mark: Acceptance Criteria

- [ ] Dashboard requires Azure AD SSO — anonymous access blocked.
- [ ] Login redirects to Azure AD and returns with valid session.
- [ ] `administrator` users access all tabs and all applications.
- [ ] `application_owner` users see only assigned applications; can edit filters for them.
- [ ] `viewer` users see only assigned applications in read-only mode.
- [ ] User Administration tab hidden from non-admin users (including direct route navigation).
- [ ] All API endpoints return 401 for unauthenticated, 403 for unauthorized requests.
- [ ] No internal details leaked in authorization error responses.
- [ ] Authentication and authorization pull requests pass the baseline CI quality gates (lint, type-check, automated tests).

## :link: Dependencies

- EPIC-BQM-002 (User Administration — roles, user-application assignments)
- EPIC-BQM-010 (CI Pipeline — baseline CI merged to protected trunk branches before epic source-code tasks begin).

## :classical_building: Architecture & Design Notes

- `Documentation/ProjectSpecifications/architecture.md` — Section 7 (Security), Section 4.1 (Tab Access Matrix)

## :clipboard: Scope

**In Scope:** Azure AD SSO integration (frontend + backend); Authorization middleware for API routes; Role-based route protection on dashboard tabs; Role-based data scoping.

**Out of Scope:** User creation/management UI (EPIC-BQM-002); MFA or conditional access policies (infrastructure concern).

## :book: Linked User Stories

- [ ] [BQM-US016] Azure AD SSO integration
- [ ] [BQM-US017] Role-based route protection
- [ ] [BQM-US018] Role-based data visibility

## :white_check_mark: Definition of Done (DoD)

- [ ] All linked User Stories are closed.
- [ ] Integration testing completed.

## :page_facing_up: PRD References

- `StakeholderDocuments/ApplicationFeatures.md` — Authentication and Authorization section
- `.specify/memory/constitution.md` — Principle V (Security & RBAC)
