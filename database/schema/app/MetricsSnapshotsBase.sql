IF OBJECT_ID('app.MetricSnapshots', 'U') IS NULL
BEGIN
    CREATE TABLE app.MetricSnapshots (
        SnapshotId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        ApplicationId UNIQUEIDENTIFIER NOT NULL,
        CalculationDate DATETIME2 NOT NULL CONSTRAINT DF_MetricSnapshots_CalculationDate DEFAULT (SYSUTCDATETIME()),
        PipelineRunId UNIQUEIDENTIFIER NULL,
        DenominatorCount INT NOT NULL,
        NumeratorCount INT NOT NULL,
        MatchedCount INT NOT NULL,
        AdoptionPct DECIMAL(7, 4) NOT NULL,
        DenominatorRevenue DECIMAL(18, 2) NULL,
        NumeratorRevenue DECIMAL(18, 2) NULL,
        MatchedRevenue DECIMAL(18, 2) NULL,
        RevenueCapturePct DECIMAL(7, 4) NULL,
        CreateDate DATETIME2 NOT NULL CONSTRAINT DF_MetricSnapshots_CreateDate DEFAULT (SYSUTCDATETIME()),
        CreatedBy NVARCHAR(128) NOT NULL,
        UpdateDate DATETIME2 NOT NULL CONSTRAINT DF_MetricSnapshots_UpdateDate DEFAULT (SYSUTCDATETIME()),
        UpdatedBy NVARCHAR(128) NOT NULL,
        CONSTRAINT FK_MetricSnapshots_Applications
            FOREIGN KEY (ApplicationId) REFERENCES app.Applications (ApplicationId),
        CONSTRAINT FK_MetricSnapshots_PipelineRuns
            FOREIGN KEY (PipelineRunId) REFERENCES app.PipelineRuns (RunId)
    );
END;
