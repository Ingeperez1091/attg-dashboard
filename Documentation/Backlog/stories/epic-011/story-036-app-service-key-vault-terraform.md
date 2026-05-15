# BQM-US036 - Provision Azure App Service and Key Vault via Terraform

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-011 (Azure Infrastructure IaC)  
> **Priority**: 1 - Critical | **Phase**: Extended-MVP B  
> **Changelog**: v2.0.0 - Reformatted to repository user story standard.

---

### :bust_in_silhouette: User Story

**As a** cloud/DevOps engineer  
**I want to** provision App Service and Key Vault through Terraform  
**So that** hosting and secrets management are secure and environment-isolated.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** Terraform deployment inputs, **When** application hosting resources are created, **Then** App Service is configured with HTTPS-only and managed identity enabled.
- **Given** Key Vault definitions and RBAC assignments, **When** infrastructure is deployed, **Then** secret-access controls are enforced.
- **Given** application configuration requirements, **When** app settings are applied, **Then** secrets are resolved through Key Vault references rather than plaintext values.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK130] Define App Service plan/web app resources with runtime configuration.
- [ ] [BQM-TK131] Define Key Vault and identity role assignments.
- [ ] [BQM-TK132] Configure Key Vault-based app settings and validate deployment outputs.

### :link: Links

- **Epic:** EPIC-BQM-011 (`Documentation/Backlog/epics/epic-011-azure-infrastructure-iac.md`)
- **Architecture:** `Documentation/ProjectSpecifications/architecture.md` - Sections 4.6, 7, 9
- **Sprint:** (Assign via Milestone)

### Business Rules

- Secrets must be managed through Key Vault and referenced by identity.
- Plaintext secret values are not allowed in deployment manifests.

### Data Impact & Pipelines

- **Reads:** Terraform runtime configuration and identity access requirements.
- **Writes:** App Service and Key Vault resources, plus deployment outputs consumed by CD workflows.


