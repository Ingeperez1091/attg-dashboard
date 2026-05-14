SET NOCOUNT ON;

IF COL_LENGTH('app.RuleChangeAudit', 'ChangeScope') IS NOT NULL
BEGIN
    IF EXISTS (
        SELECT 1
        FROM sys.check_constraints
        WHERE parent_object_id = OBJECT_ID('app.RuleChangeAudit')
          AND name = 'CK_RuleChangeAudit_ChangeScope'
    )
    BEGIN
        ALTER TABLE app.RuleChangeAudit DROP CONSTRAINT CK_RuleChangeAudit_ChangeScope;
    END;

    DECLARE @defaultConstraintName SYSNAME;
    SELECT @defaultConstraintName = dc.name
    FROM sys.default_constraints dc
    INNER JOIN sys.columns c
        ON c.object_id = dc.parent_object_id
       AND c.column_id = dc.parent_column_id
    WHERE dc.parent_object_id = OBJECT_ID('app.RuleChangeAudit')
      AND c.name = 'ChangeScope';

    IF @defaultConstraintName IS NOT NULL
    BEGIN
        DECLARE @dropDefaultSql NVARCHAR(MAX);
        SET @dropDefaultSql = N'ALTER TABLE app.RuleChangeAudit DROP CONSTRAINT ' + QUOTENAME(@defaultConstraintName) + N';';
        EXEC sp_executesql @dropDefaultSql;
    END;

    ALTER TABLE app.RuleChangeAudit DROP COLUMN ChangeScope;
END;
