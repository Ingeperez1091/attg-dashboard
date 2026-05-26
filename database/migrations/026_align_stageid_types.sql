SET NOCOUNT ON;

-- Keep StageId definitions aligned to NVARCHAR(36) for cross-table joins.
IF COL_LENGTH('app.ValidationResults', 'StageId') IS NOT NULL
BEGIN
    DECLARE @validationResultType NVARCHAR(128);
    SELECT @validationResultType = t.name
    FROM sys.columns c
    INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
    WHERE c.object_id = OBJECT_ID('app.ValidationResults')
      AND c.name = 'StageId';

    IF @validationResultType <> 'nvarchar'
    BEGIN
        ALTER TABLE app.ValidationResults ALTER COLUMN StageId NVARCHAR(36) NOT NULL;
    END;
END;

IF COL_LENGTH('app.MatchedRecords', 'StageId') IS NOT NULL
BEGIN
    DECLARE @matchedRecordsType NVARCHAR(128);
    SELECT @matchedRecordsType = t.name
    FROM sys.columns c
    INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
    WHERE c.object_id = OBJECT_ID('app.MatchedRecords')
      AND c.name = 'StageId';

    IF @matchedRecordsType <> 'nvarchar'
    BEGIN
        ALTER TABLE app.MatchedRecords ALTER COLUMN StageId NVARCHAR(36) NULL;
    END;
END;
