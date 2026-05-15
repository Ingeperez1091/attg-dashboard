# BQM-US017 — Role-Based Route Protection

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-005 (Authentication & Authorization)  
> **Priority**: 1 — Critical | **Phase**: Extended-MVP

---

### :bust_in_silhouette: User Story

**As a** system  
**I want to** protect dashboard routes and API endpoints based on the user's role  
**So that** unauthorized users cannot access features or data outside their role scope.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** a `viewer` user, **When** they navigate to the User Administration route, **Then** they are redirected away and the content is not rendered.
- **Given** a `viewer` user, **When** they `PUT` to a filter endpoint, **Then** they receive 403.
- **Given** an `application_owner`, **When** they access the User Administration route, **Then** they are blocked.
- **Given** an `administrator`, **When** they access any route, **Then** access is granted.
- **Given** any unauthorized API request, **When** processed, **Then** the response is 403 with no internal detail leakage.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK065] Implement role-based route guards in Next.js (frontend)
- [ ] [BQM-TK066] Implement role-based authorization middleware for API routes
- [ ] [BQM-TK067] Write tests for each role × route combination

### :link: Links

- **Epic:** EPIC-BQM-005 (`Documentation/Backlog/epics/epic-005-authentication-authorization.md`)
- **Architecture:** `Documentation/ProjectSpecifications/architecture.md` — Section 4.1 (Tab Access Matrix), Section 7
- **Sprint:** (Assign via Milestone)

### Business Rules

- Admin: all routes. Owner: assigned app data + filter editing. Viewer: assigned app data read-only.
- User Administration tab and route: admin only.

### Data Impact & Pipelines

- No direct data changes; affects all data access patterns.
