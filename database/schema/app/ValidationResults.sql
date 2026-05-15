IF OBJECT_ID('app.ValidationResults', 'U') IS NULL
BEGIN
    CREATE TABLE app.ValidationResults (
        ResultId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        PipelineRunId UNIQUEIDENTIFIER NOT NULL,
        StageId NVARCHAR(36) NOT NULL,
        ApplicationId UNIQUEIDENTIFIER NOT NULL,
        RecordKey NVARCHAR(256) NULL,
        Status NVARCHAR(32) NOT NULL,
        ErrorMessage NVARCHAR(512) NULL,
        CreateDate DATETIME2 NOT NULL CONSTRAINT DF_ValidationResults_CreateDate DEFAULT (SYSUTCDATETIME()),
        CreatedBy NVARCHAR(128) NOT NULL,
        UpdateDate DATETIME2 NOT NULL CONSTRAINT DF_ValidationResults_UpdateDate DEFAULT (SYSUTCDATETIME()),
        UpdatedBy NVARCHAR(128) NOT NULL,
        CONSTRAINT FK_ValidationResults_PipelineRuns
            FOREIGN KEY (PipelineRunId) REFERENCES app.PipelineRuns (RunId),
        CONSTRAINT FK_ValidationResults_Applications
            FOREIGN KEY (ApplicationId) REFERENCES app.Applications (ApplicationId)
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'IX_ValidationResults_Run_Status' AND object_id = OBJECT_ID('app.ValidationResults')
)
BEGIN
    CREATE INDEX IX_ValidationResults_Run_Status ON app.ValidationResults (PipelineRunId, Status);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'IX_ValidationResults_App_Run' AND object_id = OBJECT_ID('app.ValidationResults')
)
BEGIN
    CREATE INDEX IX_ValidationResults_App_Run ON app.ValidationResults (ApplicationId, PipelineRunId);
END;
