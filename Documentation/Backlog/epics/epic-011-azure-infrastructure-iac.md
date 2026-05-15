# EPIC-BQM-011 - Azure Infrastructure IaC

> **Azure DevOps Work Item Type**: Epic  
> **ADO ID**: _TBD - to be assigned upon creation in Azure DevOps_  
> **ADO Link**: _TBD_  
> **Phase**: Extended-MVP B  
> **Changelog**: v2.1.0 - Added stakeholder-aligned infrastructure observability baseline and diagnostics scope.

---

## :dart: Objective

Provision and govern the Azure runtime foundation with repeatable Terraform definitions, isolated environments, and security baselines required for application and data workloads.

## :memo: Description (ADO)

As a platform delivery team, the product must manage Azure infrastructure through Infrastructure as Code so environments are reproducible, auditable, and secure across development and production.

## :chart_with_upwards_trend: Business Value

- Reduces deployment risk through deterministic infrastructure provisioning.
- Enables controlled environment isolation and compliance-ready configuration.
- Improves operational readiness for application hosting, data processing, and secrets management.

## :white_check_mark: Acceptance Criteria

- [ ] Terraform remote state backend is configured and validated for environment isolation.
- [ ] Core Azure resources (resource groups, SQL, App Service, Key Vault, ADF) are provisioned from version-controlled Terraform code.
- [ ] Security and governance controls are implemented (TLS, identity-based access, baseline network restrictions).
- [ ] Foundational diagnostics settings for platform resources are provisioned for operational visibility.
- [ ] Terraform plan/apply is reproducible for dev and prod and demonstrates idempotency on re-run.

## :link: Dependencies

- EPIC-BQM-010 (Baseline CI Pipeline)
- EPIC-BQM-001 (Database Foundation)
- EPIC-BQM-007 (Metrics workload assumptions for sizing)

## :clipboard: Scope

**In Scope:** Terraform module structure, backend state configuration, Azure resource provisioning for application/data runtime, environment separation, diagnostics baseline configuration, and validation execution for dev and prod.

**Out of Scope:** Application feature implementation, dashboard UI behavior, and business KPI logic.

## :book: Linked User Stories

- [ ] [BQM-US034] Provision resource groups and remote Terraform state backend
- [ ] [BQM-US035] Provision Azure SQL server and database via Terraform
- [ ] [BQM-US036] Provision App Service and Key Vault via Terraform
- [ ] [BQM-US037] Provision Azure Data Factory via Terraform
- [ ] [BQM-US038] Validate full Terraform plan/apply for dev and prod
- [ ] [BQM-US048] Configure infrastructure diagnostics baseline via Terraform

## :classical_building: Architecture & Design Notes

- `Documentation/ProjectSpecifications/architecture.md` - Sections 4.6, 7, 9, 10
- `Documentation/ProjectSpecifications/project-structure.md` - Infra/Terraform structure conventions
- `Documentation/ProjectSpecifications/assumptions.md` - A6, A10, A25

## :white_check_mark: Definition of Done (DoD)

- [ ] All linked User Stories are closed.
- [ ] Integration testing completed.
- [ ] Terraform definitions are reproducible for dev and prod with isolated resources.
- [ ] Security and operations review sign-off completed.


