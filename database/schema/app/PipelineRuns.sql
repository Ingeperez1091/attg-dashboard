IF OBJECT_ID('app.PipelineRuns', 'U') IS NULL
BEGIN
    CREATE TABLE app.PipelineRuns (
        RunId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        ApplicationId UNIQUEIDENTIFIER NOT NULL,
        Status NVARCHAR(32) NOT NULL CONSTRAINT DF_PipelineRuns_Status DEFAULT ('Queued'),
        StartTime DATETIME2 NULL,
        EndTime DATETIME2 NULL,
        TriggerSource NVARCHAR(64) NOT NULL,
        TotalRecordsIn INT NULL,
        ValidCount INT NULL,
        InvalidCount INT NULL,
        DuplicateCount INT NULL,
        FilteredOutCount INT NULL,
        MatchedCount INT NULL,
        ErrorMessage NVARCHAR(MAX) NULL,
        SnapshotDate DATETIME2 NULL,
        CreateDate DATETIME2 NOT NULL CONSTRAINT DF_PipelineRuns_CreateDate DEFAULT (SYSUTCDATETIME()),
        CreatedBy NVARCHAR(128) NOT NULL,
        UpdateDate DATETIME2 NOT NULL CONSTRAINT DF_PipelineRuns_UpdateDate DEFAULT (SYSUTCDATETIME()),
        UpdatedBy NVARCHAR(128) NOT NULL,
        CONSTRAINT FK_PipelineRuns_Applications
            FOREIGN KEY (ApplicationId) REFERENCES app.Applications (ApplicationId)
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'IX_PipelineRuns_Application_Status' AND object_id = OBJECT_ID('app.PipelineRuns')
)
BEGIN
    CREATE INDEX IX_PipelineRuns_Application_Status ON app.PipelineRuns (ApplicationId, Status);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'IX_PipelineRuns_Application_CreateDate' AND object_id = OBJECT_ID('app.PipelineRuns')
)
BEGIN
    CREATE INDEX IX_PipelineRuns_Application_CreateDate ON app.PipelineRuns (ApplicationId, CreateDate DESC);
END;
