IF OBJECT_ID('stage.DenominatorFilterRulesPreview', 'U') IS NULL
BEGIN
    CREATE TABLE stage.DenominatorFilterRulesPreview (
        PreviewId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT PK_DenominatorFilterRulesPreview PRIMARY KEY CLUSTERED
            CONSTRAINT DF_DenominatorFilterRulesPreview_PreviewId DEFAULT (NEWID()),
        SessionId UNIQUEIDENTIFIER NOT NULL,
        ApplicationId UNIQUEIDENTIFIER NOT NULL,
        DenominatorModelId UNIQUEIDENTIFIER NOT NULL,
        Operator NVARCHAR(32) NOT NULL,
        Value NVARCHAR(512) NOT NULL,
        RuleOrder INT NOT NULL,
        CreateDate DATETIME2 NOT NULL
            CONSTRAINT DF_DenominatorFilterRulesPreview_CreateDate DEFAULT (SYSUTCDATETIME()),
        ExpiresAt DATETIME2 NOT NULL
            CONSTRAINT DF_DenominatorFilterRulesPreview_ExpiresAt DEFAULT (DATEADD(HOUR, 1, SYSUTCDATETIME())),

        CONSTRAINT FK_DenominatorFilterRulesPreview_Applications
            FOREIGN KEY (ApplicationId) REFERENCES app.Applications (ApplicationId),
        CONSTRAINT FK_DenominatorFilterRulesPreview_DenominatorModels
            FOREIGN KEY (DenominatorModelId) REFERENCES app.DenominatorModels (DenominatorModelId),
        CONSTRAINT CK_DenominatorFilterRulesPreview_Operator
            CHECK (Operator IN (
                'EQUALS', 'NOT_EQUALS', 'CONTAINS', 'NOT_CONTAINS',
                'IN_LIST', 'NOT_IN_LIST', 'GREATER_THAN', 'GREATER_OR_EQUAL',
                'LESS_THAN', 'LESS_OR_EQUAL'
            ))
    );
END;
