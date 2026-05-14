# BQM-US035 - Provision Azure SQL Server and Database via Terraform

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-011 (Azure Infrastructure IaC)  
> **Priority**: 1 - Critical | **Phase**: Extended-MVP B  
> **Changelog**: v2.0.0 - Reformatted to repository user story standard.

---

### :bust_in_silhouette: User Story

**As a** cloud/DevOps engineer  
**I want to** provision Azure SQL resources through Terraform  
**So that** application data infrastructure is reproducible and secure.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** Terraform SQL resource definitions, **When** plan/apply runs for an environment, **Then** Azure SQL server and `ATTG_Usage` database are provisioned.
- **Given** security baseline requirements, **When** SQL resources are deployed, **Then** TLS, firewall restrictions, and auditing controls are applied.
- **Given** downstream deployment dependencies, **When** Terraform completes, **Then** SQL endpoints are exposed as controlled outputs.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK120] Define SQL server and database resources with environment parameters.
- [ ] [BQM-TK121] Apply firewall/auditing/security configuration.
- [ ] [BQM-TK122] Add outputs and validate plan/apply behavior.

### :link: Links

- **Epic:** EPIC-BQM-011 (`Documentation/Backlog/epics/epic-011-azure-infrastructure-iac.md`)
- **Architecture:** `Documentation/ProjectSpecifications/architecture.md` - Sections 4.6, 7, 9
- **Sprint:** (Assign via Milestone)

### Business Rules

- SQL provisioning must be parameterized by environment.
- Security controls are mandatory and cannot be disabled by default.

### Data Impact & Pipelines

- **Reads:** Terraform variable inputs and security baseline parameters.
- **Writes:** Azure SQL server/database resources and deployment outputs for application/CD use.


