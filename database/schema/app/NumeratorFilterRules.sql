IF OBJECT_ID('app.NumeratorFilterRules', 'U') IS NULL
BEGIN
    CREATE TABLE app.NumeratorFilterRules
    (
        RuleId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_NumeratorFilterRules PRIMARY KEY,
        ApplicationId UNIQUEIDENTIFIER NOT NULL,
        ApplicationModelFieldId UNIQUEIDENTIFIER NOT NULL,
        Operator NVARCHAR(20) NOT NULL,
        Value NVARCHAR(512) NOT NULL,
        RuleOrder INT NOT NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_NumeratorFilterRules_IsActive DEFAULT (1),
        CreateDate DATETIME2 NOT NULL CONSTRAINT DF_NumeratorFilterRules_CreateDate DEFAULT (SYSUTCDATETIME()),
        CreatedBy NVARCHAR(255) NOT NULL CONSTRAINT DF_NumeratorFilterRules_CreatedBy DEFAULT (SUSER_SNAME()),
        UpdateDate DATETIME2 NOT NULL CONSTRAINT DF_NumeratorFilterRules_UpdateDate DEFAULT (SYSUTCDATETIME()),
        UpdatedBy NVARCHAR(255) NOT NULL CONSTRAINT DF_NumeratorFilterRules_UpdatedBy DEFAULT (SUSER_SNAME()),
        CONSTRAINT FK_NumeratorFilterRules_Applications FOREIGN KEY (ApplicationId) REFERENCES app.Applications(ApplicationId),
        CONSTRAINT FK_NumeratorFilterRules_ApplicationModelFields FOREIGN KEY (ApplicationModelFieldId) REFERENCES app.ApplicationModelFields(ApplicationModelFieldId),
        CONSTRAINT CK_NumeratorFilterRules_Operator CHECK (Operator IN (
            'EQUALS', 'NOT_EQUALS', 'CONTAINS', 'NOT_CONTAINS', 'IN_LIST', 'NOT_IN_LIST',
            'GREATER_THAN', 'GREATER_OR_EQUAL', 'LESS_THAN', 'LESS_OR_EQUAL'
        )),
        CONSTRAINT CK_NumeratorFilterRules_RuleOrder CHECK (RuleOrder > 0)
    );
END;
