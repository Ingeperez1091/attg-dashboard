IF OBJECT_ID('app.FilterRuleSnapshots', 'U') IS NULL
BEGIN
    CREATE TABLE app.FilterRuleSnapshots (
        SnapshotId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        PipelineRunId UNIQUEIDENTIFIER NOT NULL,
        RuleType NVARCHAR(32) NOT NULL,
        RulesJson NVARCHAR(MAX) NOT NULL,
        VersionTag NVARCHAR(128) NULL,
        CreateDate DATETIME2 NOT NULL CONSTRAINT DF_FilterRuleSnapshots_CreateDate DEFAULT (SYSUTCDATETIME()),
        CreatedBy NVARCHAR(128) NOT NULL,
        UpdateDate DATETIME2 NOT NULL CONSTRAINT DF_FilterRuleSnapshots_UpdateDate DEFAULT (SYSUTCDATETIME()),
        UpdatedBy NVARCHAR(128) NOT NULL,
        CONSTRAINT FK_FilterRuleSnapshots_PipelineRuns
            FOREIGN KEY (PipelineRunId) REFERENCES app.PipelineRuns (RunId),
        CONSTRAINT UQ_FilterRuleSnapshots_Run_RuleType
            UNIQUE (PipelineRunId, RuleType)
    );
END;
