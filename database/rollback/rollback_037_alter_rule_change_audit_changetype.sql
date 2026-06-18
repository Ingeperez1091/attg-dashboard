SET NOCOUNT ON;

-- Rollback 037: Remove ChangeType and OverrideReason from RuleChangeAudit

IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_RuleChangeAudit_ChangeType'
      AND parent_object_id = OBJECT_ID('app.RuleChangeAudit')
)
BEGIN
    ALTER TABLE app.RuleChangeAudit DROP CONSTRAINT CK_RuleChangeAudit_ChangeType;
END;

IF EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_RuleChangeAudit_App_ChangeType'
      AND object_id = OBJECT_ID('app.RuleChangeAudit')
)
BEGIN
    DROP INDEX IX_RuleChangeAudit_App_ChangeType ON app.RuleChangeAudit;
END;

IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('app.RuleChangeAudit')
      AND name = 'OverrideReason'
)
BEGIN
    ALTER TABLE app.RuleChangeAudit DROP COLUMN OverrideReason;
END;

IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('app.RuleChangeAudit')
      AND name = 'ChangeType'
)
BEGIN
    ALTER TABLE app.RuleChangeAudit DROP CONSTRAINT DF_RuleChangeAudit_ChangeType;
    ALTER TABLE app.RuleChangeAudit DROP COLUMN ChangeType;
END;
