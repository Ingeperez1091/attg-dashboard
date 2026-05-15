# BQM-US048 - Configure Infrastructure Diagnostics Baseline via Terraform

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-011 (Azure Infrastructure IaC)  
> **Priority**: 2 - High | **Phase**: Extended-MVP B  
> **Changelog**: v1.0.0 - New story for infrastructure observability baseline provisioning.

---

### :bust_in_silhouette: User Story

**As a** platform engineer  
**I want to** provision diagnostics configuration through Terraform  
**So that** runtime services emit consistent telemetry for operations monitoring.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

- **Given** Terraform environment definitions, **When** infrastructure apply runs, **Then** diagnostics settings are provisioned for key platform resources.
- **Given** diagnostics are enabled, **When** workloads execute, **Then** operational logs and metrics are emitted to the configured observability sink.
- **Given** Terraform re-apply on unchanged configuration, **When** plan runs, **Then** diagnostics baseline remains idempotent.

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK202] Add Terraform diagnostics resources for SQL, App Service, and ADF baseline telemetry
- [ ] [BQM-TK203] Parameterize diagnostics targets per environment with secure defaults
- [ ] [BQM-TK204] Add validation checks for diagnostics configuration in Terraform CI

### :link: Links

- **Epic:** EPIC-BQM-011 (`Documentation/Backlog/epics/epic-011-azure-infrastructure-iac.md`)
- **Architecture:** `Documentation/ProjectSpecifications/architecture.md` - Sections 9, 10
- **Sprint:** (Assign via Milestone)

### Business Rules

- Diagnostics defaults are mandatory for all production-bound resources.
- Observability configuration must remain environment-isolated.

### Data Impact & Pipelines

- **Reads:** Terraform modules, environment variables, diagnostics configuration.
- **Writes:** Azure diagnostics settings and telemetry routing configuration.
