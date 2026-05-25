SET NOCOUNT ON;

/*
 * Migration: 029_add_identifier_format_constraints.sql
 * Purpose: Defense-in-depth CHECK constraints to reject SQL-injection-risky
 *          values at the database layer for columns used in dynamic SQL.
 *
 * Affected tables:
 *   app.DenominatorModels       — SourceColumn, FieldName
 *   app.AdoptionSettings        — RevenueMetric
 *   app.ApplicationModelFields  — FieldName, SourcePath
 *   app.DenominatorFilterRules  — Value (no quotes, comments, or statement-breaking patterns)
 *   app.NumeratorFilterRules    — Value (same restrictions)
 *   app.ApplicationModelFields  — FieldName, SourcePath
 *
 * Pattern rules:
 *   Safe identifier: starts with [A-Za-z_], contains only [A-Za-z0-9_]
 *   Bracketed identifier: [SafeIdentifier]
 *   JSON path: starts with $., contains only [A-Za-z0-9_.\[\]]
 */

-- ============================================================================
-- 1. app.DenominatorModels.SourceColumn — must be [SafeIdentifier]
-- ============================================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_DenominatorModels_SourceColumn_SafeIdentifier'
      AND parent_object_id = OBJECT_ID('app.DenominatorModels')
)
BEGIN
    ALTER TABLE app.DenominatorModels
    ADD CONSTRAINT CK_DenominatorModels_SourceColumn_SafeIdentifier
    CHECK (
        LEN(SourceColumn) >= 3
        AND LEFT(SourceColumn, 1) = '['
        AND RIGHT(SourceColumn, 1) = ']'
        AND SUBSTRING(SourceColumn, 2, LEN(SourceColumn) - 2) LIKE '[A-Za-z_]%'
        AND SUBSTRING(SourceColumn, 2, LEN(SourceColumn) - 2) NOT LIKE '%[^A-Za-z0-9_]%'
    );
END;

-- ============================================================================
-- 2. app.DenominatorModels.FieldName — must be safe identifier
-- ============================================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_DenominatorModels_FieldName_SafeIdentifier'
      AND parent_object_id = OBJECT_ID('app.DenominatorModels')
)
BEGIN
    ALTER TABLE app.DenominatorModels
    ADD CONSTRAINT CK_DenominatorModels_FieldName_SafeIdentifier
    CHECK (
        LEN(FieldName) >= 1
        AND FieldName LIKE '[A-Za-z_]%'
        AND FieldName NOT LIKE '%[^A-Za-z0-9_]%'
    );
END;

-- ============================================================================
-- 3. app.AdoptionSettings.RevenueMetric — must be safe identifier
-- ============================================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_AdoptionSettings_RevenueMetric_SafeIdentifier'
      AND parent_object_id = OBJECT_ID('app.AdoptionSettings')
)
BEGIN
    ALTER TABLE app.AdoptionSettings
    ADD CONSTRAINT CK_AdoptionSettings_RevenueMetric_SafeIdentifier
    CHECK (
        LEN(RevenueMetric) >= 1
        AND RevenueMetric LIKE '[A-Za-z_]%'
        AND RevenueMetric NOT LIKE '%[^A-Za-z0-9_]%'
    );
END;

-- ============================================================================
-- 4. app.ApplicationModelFields.FieldName — must be safe identifier
-- ============================================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_ApplicationModelFields_FieldName_SafeIdentifier'
      AND parent_object_id = OBJECT_ID('app.ApplicationModelFields')
)
BEGIN
    ALTER TABLE app.ApplicationModelFields
    ADD CONSTRAINT CK_ApplicationModelFields_FieldName_SafeIdentifier
    CHECK (
        LEN(FieldName) >= 1
        AND FieldName LIKE '[A-Za-z_]%'
        AND FieldName NOT LIKE '%[^A-Za-z0-9_]%'
    );
END;

-- ============================================================================
-- 5. app.ApplicationModelFields.SourcePath — must be safe JSON path ($.xxx)
-- ============================================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_ApplicationModelFields_SourcePath_SafeJsonPath'
      AND parent_object_id = OBJECT_ID('app.ApplicationModelFields')
)
BEGIN
    ALTER TABLE app.ApplicationModelFields
    ADD CONSTRAINT CK_ApplicationModelFields_SourcePath_SafeJsonPath
    CHECK (
        LEN(SourcePath) >= 3
        AND LEFT(SourcePath, 2) = '$.'
        AND SUBSTRING(SourcePath, 3, LEN(SourcePath) - 2) LIKE '[A-Za-z_]%'
        AND SUBSTRING(SourcePath, 3, LEN(SourcePath) - 2) NOT LIKE '%[^A-Za-z0-9_.]%'
    );
END;

-- ============================================================================
-- 6. app.DenominatorFilterRules.Value — reject SQL injection patterns
-- ============================================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_DenominatorFilterRules_Value_NoInjection'
      AND parent_object_id = OBJECT_ID('app.DenominatorFilterRules')
)
BEGIN
    ALTER TABLE app.DenominatorFilterRules
    ADD CONSTRAINT CK_DenominatorFilterRules_Value_NoInjection
    CHECK (
        Value NOT LIKE '%''%'
        AND Value NOT LIKE '%--%'
        AND Value NOT LIKE '%/*%'
        AND Value NOT LIKE '%*/%'
    );
END;

-- ============================================================================
-- 7. app.NumeratorFilterRules.Value — reject SQL injection patterns
-- ============================================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_NumeratorFilterRules_Value_NoInjection'
      AND parent_object_id = OBJECT_ID('app.NumeratorFilterRules')
)
BEGIN
    ALTER TABLE app.NumeratorFilterRules
    ADD CONSTRAINT CK_NumeratorFilterRules_Value_NoInjection
    CHECK (
        Value NOT LIKE '%''%'
        AND Value NOT LIKE '%--%'
        AND Value NOT LIKE '%/*%'
        AND Value NOT LIKE '%*/%'
    );
END;

PRINT 'Migration 029: Identifier format constraints applied successfully.';
