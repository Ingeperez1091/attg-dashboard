# BQM-US038 - Validate Full Terraform Plan/Apply for Dev and Prod

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-011 (Azure Infrastructure IaC)  
> **Priority**: 2 - High | **Phase**: Extended-MVP B  
> **Changelog**: v2.0.0 - Reformatted to repository user story standard.

---

### :bust_in_silhouette: User Story

**As a** cloud/DevOps engineer  
**I want to** validate full Terraform execution across environments  
**So that** infrastructure reproducibility and readiness are proven.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** dev environment configuration, **When** full init/plan/apply executes, **Then** deployment succeeds without manual intervention.
- **Given** prod environment configuration, **When** full plan/apply executes, **Then** deployment succeeds using isolated parameters.
- **Given** unchanged infrastructure code and inputs, **When** Terraform is re-applied, **Then** execution returns idempotent `No changes` status.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK150] Run and validate init/plan/apply workflow in dev.
- [ ] [BQM-TK151] Run and validate plan/apply workflow in prod.
- [ ] [BQM-TK152] Add CI validation checks for Terraform formatting and validation.

### :link: Links

- **Epic:** EPIC-BQM-011 (`Documentation/Backlog/epics/epic-011-azure-infrastructure-iac.md`)
- **Architecture:** `Documentation/ProjectSpecifications/architecture.md` - Sections 4.5, 4.6
- **Sprint:** (Assign via Milestone)

### Business Rules

- Validation must cover both target environments before infra sign-off.
- Idempotency is a mandatory quality gate for Terraform readiness.

### Data Impact & Pipelines

- **Reads:** Terraform modules, variables, and backend state.
- **Writes:** Deployment run artifacts and validation evidence for release governance.


