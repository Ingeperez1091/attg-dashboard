SET NOCOUNT ON;

-- ============================================================
-- Migration 037: ALTER app.RuleChangeAudit — Add ChangeType and OverrideReason
-- Purpose: Support force-save governance by tracking whether a
--          rule change was a normal update or an admin force-override.
-- ============================================================

-- Add ChangeType column (default 'Update' for existing rows)
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('app.RuleChangeAudit')
      AND name = 'ChangeType'
)
BEGIN
    ALTER TABLE app.RuleChangeAudit
    ADD ChangeType NVARCHAR(32) NOT NULL
        CONSTRAINT DF_RuleChangeAudit_ChangeType DEFAULT ('Update');
END;

-- Add OverrideReason column (NULL for normal updates)
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('app.RuleChangeAudit')
      AND name = 'OverrideReason'
)
BEGIN
    ALTER TABLE app.RuleChangeAudit
    ADD OverrideReason NVARCHAR(500) NULL;
END;

-- Add CHECK constraint on ChangeType values
IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_RuleChangeAudit_ChangeType'
      AND parent_object_id = OBJECT_ID('app.RuleChangeAudit')
)
BEGIN
    ALTER TABLE app.RuleChangeAudit
    ADD CONSTRAINT CK_RuleChangeAudit_ChangeType
        CHECK (ChangeType IN ('Update', 'ForceOverride'));
END;

-- Add index for force-override audit queries
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_RuleChangeAudit_App_ChangeType'
      AND object_id = OBJECT_ID('app.RuleChangeAudit')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_RuleChangeAudit_App_ChangeType
        ON app.RuleChangeAudit (ApplicationId, ChangeType)
        INCLUDE (ActorUserId, ChangedAt);
END;
