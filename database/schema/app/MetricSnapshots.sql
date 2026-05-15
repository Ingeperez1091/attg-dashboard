IF OBJECT_ID('app.MetricSnapshots', 'U') IS NULL
BEGIN
    CREATE TABLE app.MetricSnapshots (
        SnapshotId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_MetricSnapshots PRIMARY KEY,
        RunId UNIQUEIDENTIFIER NOT NULL,
        ApplicationId UNIQUEIDENTIFIER NOT NULL,
        CalculationDate DATETIME2 NOT NULL CONSTRAINT DF_MetricSnapshots_CalculationDate DEFAULT (SYSUTCDATETIME()),
        DenominatorCount INT NOT NULL,
        NumeratorCount INT NOT NULL,
        MatchedCount INT NOT NULL,
        AdoptionPct DECIMAL(10, 4) NOT NULL,
        DenominatorRevenue DECIMAL(18, 2) NULL,
        NumeratorRevenue DECIMAL(18, 2) NULL,
        RevenuePct DECIMAL(10, 4) NOT NULL,
        AvgEngagement DECIMAL(10, 4) NULL,
        MetricDefinitionVersion NVARCHAR(32) NOT NULL CONSTRAINT DF_MetricSnapshots_MetricDefinitionVersion DEFAULT (N'EPIC-007-v1'),
        RefreshTimestamp DATETIME2 NOT NULL CONSTRAINT DF_MetricSnapshots_RefreshTimestamp DEFAULT (SYSUTCDATETIME()),
        SourceBatchId NVARCHAR(256) NULL,
        FilterRuleSnapshotId UNIQUEIDENTIFIER NULL,
        CreateDate DATETIME2 NOT NULL CONSTRAINT DF_MetricSnapshots_CreateDate DEFAULT (SYSUTCDATETIME()),
        CreatedBy NVARCHAR(128) NOT NULL,
        CONSTRAINT FK_MetricSnapshots_RunId FOREIGN KEY (RunId) REFERENCES app.PipelineRuns (RunId),
        CONSTRAINT FK_MetricSnapshots_ApplicationId FOREIGN KEY (ApplicationId) REFERENCES app.Applications (ApplicationId),
        CONSTRAINT FK_MetricSnapshots_FilterRuleSnapshotId FOREIGN KEY (FilterRuleSnapshotId) REFERENCES app.FilterRuleSnapshots (SnapshotId)
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_MetricSnapshots_RunId'
      AND object_id = OBJECT_ID('app.MetricSnapshots')
)
BEGIN
    CREATE INDEX IX_MetricSnapshots_RunId ON app.MetricSnapshots (RunId);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_MetricSnapshots_Application_CalculationDate'
      AND object_id = OBJECT_ID('app.MetricSnapshots')
)
BEGIN
    CREATE INDEX IX_MetricSnapshots_Application_CalculationDate
        ON app.MetricSnapshots (ApplicationId, CalculationDate DESC);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_MetricSnapshots_Application_RefreshTimestamp'
      AND object_id = OBJECT_ID('app.MetricSnapshots')
)
BEGIN
    CREATE INDEX IX_MetricSnapshots_Application_RefreshTimestamp
        ON app.MetricSnapshots (ApplicationId, RefreshTimestamp DESC);
END;
