# Deployment Order

## Required Order

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
21. `021_create_metric_snapshots.sql`
22. `026_metrics_snapshot_and_dummy_facts.sql`
23. `025_align_stageid_types.sql`
24. `022_create_usp_build_filtered_denominator.sql`
25. `023_create_usp_apply_numerator_filters.sql`
26. `024_create_usp_execute_pipeline_run.sql`
27. `027_enforce_single_metric_dimension.sql`
28. `028_refresh_usp_calculate_metrics.sql`
29. `external-access-validation.sql`

## Failure Handling

- Stop on any DDL failure
- Resolve the failing script
- Rerun from the failed step (scripts are idempotent)

## Notes

- Do not create `vw_USTaxBTS_FY26_MaxACD` locally.
- Validate external Mercury connectivity separately with provided credentials.
