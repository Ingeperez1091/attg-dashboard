# BQM-US037 - Provision Azure Data Factory via Terraform

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-011 (Azure Infrastructure IaC)  
> **Priority**: 2 - High | **Phase**: Extended-MVP B  
> **Changelog**: v2.0.0 - Reformatted to repository user story standard.

---

### :bust_in_silhouette: User Story

**As a** cloud/DevOps engineer  
**I want to** provision Azure Data Factory via Terraform  
**So that** orchestration infrastructure is reproducible and governed.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** Terraform ADF resource definitions, **When** environment deployment runs, **Then** ADF is provisioned with managed identity.
- **Given** identity-based access requirements, **When** role assignments are applied, **Then** ADF can access required SQL and Key Vault dependencies.
- **Given** environment segregation standards, **When** provisioning completes, **Then** isolated ADF instances are available for dev and prod.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK140] Define ADF resource and environment-specific configuration.
- [ ] [BQM-TK141] Configure role assignments for Key Vault and SQL access.
- [ ] [BQM-TK142] Validate outputs for downstream pipeline deployment usage.

### :link: Links

- **Epic:** EPIC-BQM-011 (`Documentation/Backlog/epics/epic-011-azure-infrastructure-iac.md`)
- **Architecture:** `Documentation/ProjectSpecifications/architecture.md` - Sections 4.6, 5
- **Sprint:** (Assign via Milestone)

### Business Rules

- ADF must authenticate using managed identity for governed access.
- Environment-specific ADF resources cannot share deployment state.

### Data Impact & Pipelines

- **Reads:** Terraform config and environment parameters.
- **Writes:** Azure Data Factory resource and identity/role assignments used by ETL orchestration.


