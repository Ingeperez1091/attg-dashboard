SET NOCOUNT ON;

/*
 * Rollback: 029_add_identifier_format_constraints.sql
 * Drops all CHECK constraints added by migration 029.
 */

IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_DenominatorModels_SourceColumn_SafeIdentifier'
      AND parent_object_id = OBJECT_ID('app.DenominatorModels')
)
    ALTER TABLE app.DenominatorModels DROP CONSTRAINT CK_DenominatorModels_SourceColumn_SafeIdentifier;

IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_DenominatorModels_FieldName_SafeIdentifier'
      AND parent_object_id = OBJECT_ID('app.DenominatorModels')
)
    ALTER TABLE app.DenominatorModels DROP CONSTRAINT CK_DenominatorModels_FieldName_SafeIdentifier;

IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_AdoptionSettings_RevenueMetric_SafeIdentifier'
      AND parent_object_id = OBJECT_ID('app.AdoptionSettings')
)
    ALTER TABLE app.AdoptionSettings DROP CONSTRAINT CK_AdoptionSettings_RevenueMetric_SafeIdentifier;

IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_ApplicationModelFields_FieldName_SafeIdentifier'
      AND parent_object_id = OBJECT_ID('app.ApplicationModelFields')
)
    ALTER TABLE app.ApplicationModelFields DROP CONSTRAINT CK_ApplicationModelFields_FieldName_SafeIdentifier;

IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_ApplicationModelFields_SourcePath_SafeJsonPath'
      AND parent_object_id = OBJECT_ID('app.ApplicationModelFields')
)
    ALTER TABLE app.ApplicationModelFields DROP CONSTRAINT CK_ApplicationModelFields_SourcePath_SafeJsonPath;

IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_DenominatorFilterRules_Value_NoInjection'
      AND parent_object_id = OBJECT_ID('app.DenominatorFilterRules')
)
    ALTER TABLE app.DenominatorFilterRules DROP CONSTRAINT CK_DenominatorFilterRules_Value_NoInjection;

IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_NumeratorFilterRules_Value_NoInjection'
      AND parent_object_id = OBJECT_ID('app.NumeratorFilterRules')
)
    ALTER TABLE app.NumeratorFilterRules DROP CONSTRAINT CK_NumeratorFilterRules_Value_NoInjection;

PRINT 'Rollback 029: Identifier format constraints removed.';
