# BQM-US016 — Azure AD SSO Integration

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-005 (Authentication & Authorization)  
> **Priority**: 1 — Critical | **Phase**: Extended-MVP

---

### :bust_in_silhouette: User Story

**As a** user  
**I want to** log in to the dashboard using my Azure AD corporate credentials  
**So that** I have secure, seamless access without creating separate login credentials.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** I navigate to the dashboard without a session, **When** the page loads, **Then** I am redirected to Azure AD login.
- **Given** I authenticate successfully, **When** redirected back, **Then** I have a valid session and see the dashboard.
- **Given** I have an invalid or expired session, **When** I make an API request, **Then** I receive a 401 response.
- **Given** anonymous access is attempted, **When** any page or API is requested, **Then** it is blocked with a redirect to login.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK061] Configure Azure AD app registration
- [ ] [BQM-TK062] Integrate MSAL.js in Next.js frontend
- [ ] [BQM-TK063] Add session validation middleware to API routes
- [ ] [BQM-TK064] Write integration tests for auth flow

### :link: Links

- **Epic:** EPIC-BQM-005 (`Documentation/Backlog/epics/epic-005-authentication-authorization.md`)
- **PRD:** `StakeholderDocuments/ApplicationFeatures.md` — "Users authenticate through Azure AD"
- **Constitution:** Principle V — Azure AD SSO, anonymous access prohibited
- **Sprint:** (Assign via Milestone)

### Business Rules

- Azure AD SSO is the only authentication method. No local username/password.

### Data Impact & Pipelines

- No direct data writes. Session context provides CreatedBy/UpdatedBy for audit columns.
