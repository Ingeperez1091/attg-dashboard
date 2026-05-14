SET NOCOUNT ON;

IF OBJECT_ID('app.RuleChangeAudit', 'U') IS NULL
BEGIN
    THROW 50001, 'Table app.RuleChangeAudit does not exist.', 1;
END;

IF COL_LENGTH('app.RuleChangeAudit', 'ChangeScope') IS NULL
BEGIN
    EXEC(N'ALTER TABLE app.RuleChangeAudit ADD ChangeScope NVARCHAR(32) NULL;');
    EXEC(N'UPDATE app.RuleChangeAudit SET ChangeScope = ''Numerator'' WHERE ChangeScope IS NULL;');
    EXEC(N'ALTER TABLE app.RuleChangeAudit ALTER COLUMN ChangeScope NVARCHAR(32) NOT NULL;');
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.default_constraints
    WHERE parent_object_id = OBJECT_ID('app.RuleChangeAudit')
      AND name = 'DF_RuleChangeAudit_ChangeScope'
)
BEGIN
    EXEC(N'ALTER TABLE app.RuleChangeAudit ADD CONSTRAINT DF_RuleChangeAudit_ChangeScope DEFAULT (''Numerator'') FOR ChangeScope;');
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('app.RuleChangeAudit')
      AND name = 'CK_RuleChangeAudit_ChangeScope'
)
BEGIN
    EXEC(N'ALTER TABLE app.RuleChangeAudit ADD CONSTRAINT CK_RuleChangeAudit_ChangeScope CHECK (ChangeScope IN (''Numerator'', ''Denominator'', ''Adoption''));');
END;
