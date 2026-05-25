#!/bin/bash
set -e

SQLCMD="/opt/mssql-tools18/bin/sqlcmd"
CONN="-S $SQL_SERVER -U sa -P $SA_PASSWORD -C"

echo "[init-db] Creating database $SQL_DATABASE if not exists..."
$SQLCMD $CONN -Q "IF DB_ID('$SQL_DATABASE') IS NULL CREATE DATABASE [$SQL_DATABASE];" -b

# Migration files in deployment order
MIGRATIONS=(
  001_create_schemas.sql
  002_create_audit_conventions.sql
  003_create_app_schema_objects.sql
  004_create_stage_engagement_usage_raw.sql
  005_run_seed_scripts.sql
  006_create_application_model_fields.sql
  007_create_numerator_filter_rules.sql
  008_create_rule_change_audit.sql
  009_seed_application_model_fields.sql
  010_create_denominator_models.sql
  011_create_denominator_filter_rules.sql
  012_create_adoption_settings.sql
  013_alter_rule_change_audit_add_scope.sql
  014_seed_denominator_models_and_adoption_settings.sql
  015_create_pipeline_runs.sql
  016_create_validation_results.sql
  017_create_matched_records.sql
  018_create_filter_rule_snapshots.sql
  019_create_denominator_snapshot.sql
  020_create_vw_denominator_local.sql
  021_create_metric_snapshots.sql
  026_metrics_snapshot_and_dummy_facts.sql
  025_align_stageid_types.sql
  022_create_usp_build_filtered_denominator.sql
  023_create_usp_apply_numerator_filters.sql
  024_create_usp_execute_pipeline_run.sql
  027_enforce_single_metric_dimension.sql
  028_refresh_usp_calculate_metrics.sql
)

echo "[init-db] Running migrations..."
for migration in "${MIGRATIONS[@]}"; do
  file="/migrations/$migration"
  if [ -f "$file" ]; then
    echo "[init-db]   Applying $migration"
    $SQLCMD $CONN -d "$SQL_DATABASE" -i "$file" -I -b
    if [ $? -ne 0 ]; then
      echo "[init-db] ERROR: Migration failed: $migration"
      exit 1
    fi
  else
    echo "[init-db]   SKIP (not found): $migration"
  fi
done

echo "[init-db] Database initialization complete."
