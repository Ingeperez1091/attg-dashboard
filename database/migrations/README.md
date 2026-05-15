# Database Foundation Migration Guide

## Scope

This guide deploys the database foundation and denominator configuration migrations.

## Prerequisites

- Azure SQL database connection
- Permission to create schemas, tables, indexes, defaults, and triggers
- Mercury connection details for external denominator validation

## Execution Order

1. `001_create_schemas.sql`
2. `002_create_audit_conventions.sql`
3. `003_create_app_schema_objects.sql`
4. `004_create_stage_engagement_usage_raw.sql`
5. `005_run_seed_scripts.sql`
6. `006_create_application_model_fields.sql`
7. `007_create_numerator_filter_rules.sql`
8. `008_create_rule_change_audit.sql`
9. `009_seed_application_model_fields.sql`
10. `010_create_denominator_models.sql`
11. `011_create_denominator_filter_rules.sql`
12. `012_create_adoption_settings.sql`
13. `013_alter_rule_change_audit_add_scope.sql`
14. `014_seed_denominator_models_and_adoption_settings.sql`
15. `015_create_pipeline_runs.sql`
16. `016_create_validation_results.sql`
17. `017_create_matched_records.sql`
18. `018_create_filter_rule_snapshots.sql`
19. `019_create_denominator_snapshot.sql`
20. `020_create_vw_denominator_local.sql`
21. `021_create_metric_snapshots.sql` (schema only in EPIC-BQM-006)
22. `026_metrics_snapshot_and_dummy_facts.sql`
23. `025_align_stageid_types.sql`
24. `022_create_usp_build_filtered_denominator.sql`
25. `023_create_usp_apply_numerator_filters.sql`
26. `024_create_usp_execute_pipeline_run.sql`
27. `027_enforce_single_metric_dimension.sql`
28. `028_refresh_usp_calculate_metrics.sql`
29. `../views/external-access-validation.sql`

## Automated Setup (Recommended)

Run the full setup workflow with:

```powershell
.\scripts\database\setup-database.ps1 -UseTrustedConnection
```

Default target values are:

- Server/Instance: `.\SQLEXPRESS`
- Database: `ATTG_Usage`

To override defaults:

```powershell
.\scripts\database\setup-database.ps1 -Server ".\SQLEXPRESS" -Database "ATTG_Usage" -UseTrustedConnection
```

The script will:

- Ensure `sqlcmd` is installed
- Start SQL services and check `SQLBrowser`
- Prepare the target instance/session
- Create the target database if missing
- Execute migration and validation scripts in order

## Rollback

Rollback scripts are located in `database/rollback` and mapped by index to migrations.

Run rollback in descending order with:

```powershell
.\scripts\database\run-rollback.ps1 -UseTrustedConnection
```

Default rollback range is currently:

- `From = 25`
- `To = 6`

Validation processing rollback bundle:

- `database/rollback/rollback_015_025_validation_processing.sql`

EPIC-BQM-007 rollback scripts:

- `database/rollback/rollback_026_metrics_snapshot_and_dummy_facts.sql`
- `database/rollback/rollback_027_enforce_single_metric_dimension.sql`
- `database/rollback/rollback_028_refresh_usp_calculate_metrics.sql`

To rollback a custom range:

```powershell
.\scripts\database\run-rollback.ps1 -ServerInstance ".\SQLEXPRESS" -Database "ATTG_Usage" -From 14 -To 10 -UseTrustedConnection
```

## Idempotency Expectations

- Scripts are safe to rerun.
- Seed scripts upsert by stable business keys.
- Validation script is read-only.
- Denominator migrations are additive and preserve existing numerator behavior.

## Post-Deployment Checks

Run `database/views/external-access-validation.sql` and confirm:

- Required schemas and tables exist
- Required audit columns exist
- Seed counts are expected
- External Mercury connectivity is validated (when credentials are available)


### Mercury-connected validation execution:

To check the connection to DB where is the view with Mercuty data run:

```powershell
.\scripts\database\run-mercury-validation.ps1 -Server "<server-name>" -Database "<database-name>" -UseTrustedConnection
```

As it is in other db and use a different user, you must use the following options:

Use the trusted-connection mode with a PSCredential object.

Option 1 (recommended, prompts securely):

```powershell
$cred = Get-Credential "DOMAIN\new.user"
.\scripts\database\run-mercury-validation.ps1 -Server "<server-name>" -Database "<database-name>" -UseTrustedConnection -Credential $cred
```

Option 2 (non-interactive, explicit username/password):

```powershell
$securePwd = ConvertTo-SecureString "YourPasswordHere" -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential("DOMAIN\new.user", $securePwd)
.\scripts\database\run-mercury-validation.ps1 -Server "<server-name>" -Database "<database-name>" -UseTrustedConnection -Credential $cred
```


Username formats you can use:

DOMAIN\username
username@domain.com
.\localusername (for local machine accounts)
