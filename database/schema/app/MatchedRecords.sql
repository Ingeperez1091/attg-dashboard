IF OBJECT_ID('app.MatchedRecords', 'U') IS NULL
BEGIN
    CREATE TABLE app.MatchedRecords (
        MatchedId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        PipelineRunId UNIQUEIDENTIFIER NOT NULL,
        ApplicationId UNIQUEIDENTIFIER NOT NULL,
        NumeratorKey NVARCHAR(256) NOT NULL,
        DenominatorKey NVARCHAR(256) NOT NULL,
        RevenueAmount DECIMAL(18, 2) NULL,
        StageId NVARCHAR(36) NULL,
        CreateDate DATETIME2 NOT NULL CONSTRAINT DF_MatchedRecords_CreateDate DEFAULT (SYSUTCDATETIME()),
        CreatedBy NVARCHAR(128) NOT NULL,
        UpdateDate DATETIME2 NOT NULL CONSTRAINT DF_MatchedRecords_UpdateDate DEFAULT (SYSUTCDATETIME()),
        UpdatedBy NVARCHAR(128) NOT NULL,
        CONSTRAINT FK_MatchedRecords_PipelineRuns
            FOREIGN KEY (PipelineRunId) REFERENCES app.PipelineRuns (RunId),
        CONSTRAINT FK_MatchedRecords_Applications
            FOREIGN KEY (ApplicationId) REFERENCES app.Applications (ApplicationId)
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'IX_MatchedRecords_Run_App' AND object_id = OBJECT_ID('app.MatchedRecords')
)
BEGIN
    CREATE INDEX IX_MatchedRecords_Run_App ON app.MatchedRecords (PipelineRunId, ApplicationId);
END;
