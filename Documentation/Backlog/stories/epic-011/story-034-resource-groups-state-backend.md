# BQM-US034 - Provision Resource Groups and Remote Terraform State Backend

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-011 (Azure Infrastructure IaC)  
> **Priority**: 1 - Critical | **Phase**: Extended-MVP B  
> **Changelog**: v2.0.0 - Reformatted to repository user story standard.

---

### :bust_in_silhouette: User Story

**As a** cloud/DevOps engineer  
**I want to** initialize Terraform foundation and remote state for isolated environments  
**So that** all infrastructure provisioning runs consistently and safely.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** Terraform backend configuration for Azure Blob Storage, **When** `terraform init` runs, **Then** remote state initializes successfully.
- **Given** dev and prod environment variables, **When** base Terraform deployment executes, **Then** environment-specific resource groups are created in isolation.
- **Given** repository quality controls, **When** changes are validated, **Then** no local Terraform state files are committed.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK110] Create Terraform base files and provider configuration.
- [ ] [BQM-TK111] Configure remote backend and environment-specific state keys.
- [ ] [BQM-TK112] Validate init/plan/apply for dev and prod baselines.

### :link: Links

- **Epic:** EPIC-BQM-011 (`Documentation/Backlog/epics/epic-011-azure-infrastructure-iac.md`)
- **Architecture:** `Documentation/ProjectSpecifications/architecture.md` - Sections 4.6, 7
- **Sprint:** (Assign via Milestone)

### Business Rules

- Each environment uses a dedicated state key and isolated resource group naming convention.
- State backend must be remote and centrally governed.

### Data Impact & Pipelines

- **Reads:** Terraform variable files and backend configuration.
- **Writes:** Azure resource groups and remote Terraform state metadata.


