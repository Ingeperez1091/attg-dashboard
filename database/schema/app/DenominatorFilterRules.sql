IF OBJECT_ID('app.DenominatorFilterRules', 'U') IS NULL
BEGIN
    CREATE TABLE app.DenominatorFilterRules
    (
        RuleId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_DenominatorFilterRules PRIMARY KEY,
        ApplicationId UNIQUEIDENTIFIER NOT NULL,
        DenominatorModelId UNIQUEIDENTIFIER NOT NULL,
        Operator NVARCHAR(32) NOT NULL,
        Value NVARCHAR(512) NOT NULL,
        RuleOrder INT NOT NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_DenominatorFilterRules_IsActive DEFAULT (1),
        CreateDate DATETIME2 NOT NULL CONSTRAINT DF_DenominatorFilterRules_CreateDate DEFAULT (SYSUTCDATETIME()),
        CreatedBy NVARCHAR(255) NOT NULL CONSTRAINT DF_DenominatorFilterRules_CreatedBy DEFAULT (SUSER_SNAME()),
        UpdateDate DATETIME2 NOT NULL CONSTRAINT DF_DenominatorFilterRules_UpdateDate DEFAULT (SYSUTCDATETIME()),
        UpdatedBy NVARCHAR(255) NOT NULL CONSTRAINT DF_DenominatorFilterRules_UpdatedBy DEFAULT (SUSER_SNAME()),
        CONSTRAINT FK_DenominatorFilterRules_Applications FOREIGN KEY (ApplicationId) REFERENCES app.Applications(ApplicationId),
        CONSTRAINT FK_DenominatorFilterRules_DenominatorModels FOREIGN KEY (DenominatorModelId) REFERENCES app.DenominatorModels(DenominatorModelId),
        CONSTRAINT CK_DenominatorFilterRules_Operator CHECK (Operator IN (
            'EQUALS', 'NOT_EQUALS', 'CONTAINS', 'NOT_CONTAINS', 'IN_LIST', 'NOT_IN_LIST',
            'GREATER_THAN', 'GREATER_OR_EQUAL', 'LESS_THAN', 'LESS_OR_EQUAL'
        )),
        CONSTRAINT CK_DenominatorFilterRules_RuleOrder CHECK (RuleOrder >= 1)
    );
END;
