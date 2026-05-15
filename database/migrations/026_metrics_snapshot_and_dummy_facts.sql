SET NOCOUNT ON;

/*
  EPIC-BQM-007 foundation migration.
  - Aligns app.MetricSnapshots to metrics-calculation contract
  - Creates app.InvestmentDummyFacts for deterministic synthetic investment context
*/

:r ..\schema\app\MetricSnapshots.sql
:r ..\schema\app\InvestmentDummyFacts.sql

IF COL_LENGTH('app.MetricSnapshots', 'RunId') IS NULL
BEGIN
    ALTER TABLE app.MetricSnapshots ADD RunId UNIQUEIDENTIFIER NULL;
END;

IF COL_LENGTH('app.MetricSnapshots', 'PipelineRunId') IS NOT NULL
BEGIN
        EXEC sp_executesql N'
                UPDATE app.MetricSnapshots
                SET RunId = PipelineRunId
                WHERE RunId IS NULL
                    AND PipelineRunId IS NOT NULL;
        ';
END;

IF COL_LENGTH('app.MetricSnapshots', 'RevenuePct') IS NULL
BEGIN
    ALTER TABLE app.MetricSnapshots ADD RevenuePct DECIMAL(10, 4) NULL;
END;

IF COL_LENGTH('app.MetricSnapshots', 'AvgEngagement') IS NULL
BEGIN
    ALTER TABLE app.MetricSnapshots ADD AvgEngagement DECIMAL(10, 4) NULL;
END;

IF COL_LENGTH('app.MetricSnapshots', 'MetricDefinitionVersion') IS NULL
BEGIN
    ALTER TABLE app.MetricSnapshots
    ADD MetricDefinitionVersion NVARCHAR(32) NULL;

    EXEC sp_executesql N'
        UPDATE app.MetricSnapshots
        SET MetricDefinitionVersion = N''EPIC-007-v1''
        WHERE MetricDefinitionVersion IS NULL;
    ';

    EXEC sp_executesql N'
        ALTER TABLE app.MetricSnapshots
        ALTER COLUMN MetricDefinitionVersion NVARCHAR(32) NOT NULL;
    ';
END;

IF COL_LENGTH('app.MetricSnapshots', 'RefreshTimestamp') IS NULL
BEGIN
    ALTER TABLE app.MetricSnapshots
    ADD RefreshTimestamp DATETIME2 NULL;

    EXEC sp_executesql N'
        UPDATE app.MetricSnapshots
        SET RefreshTimestamp = COALESCE(UpdateDate, CreateDate, SYSUTCDATETIME())
        WHERE RefreshTimestamp IS NULL;
    ';

    EXEC sp_executesql N'
        ALTER TABLE app.MetricSnapshots
        ALTER COLUMN RefreshTimestamp DATETIME2 NOT NULL;
    ';
END;

IF COL_LENGTH('app.MetricSnapshots', 'SourceBatchId') IS NULL
BEGIN
    ALTER TABLE app.MetricSnapshots ADD SourceBatchId NVARCHAR(256) NULL;
END;

IF COL_LENGTH('app.MetricSnapshots', 'DenominatorRevenue') IS NULL
BEGIN
    ALTER TABLE app.MetricSnapshots ADD DenominatorRevenue DECIMAL(18, 2) NULL;
END;

IF COL_LENGTH('app.MetricSnapshots', 'NumeratorRevenue') IS NULL
BEGIN
    ALTER TABLE app.MetricSnapshots ADD NumeratorRevenue DECIMAL(18, 2) NULL;
END;

IF COL_LENGTH('app.MetricSnapshots', 'FilterRuleSnapshotId') IS NULL
BEGIN
    ALTER TABLE app.MetricSnapshots ADD FilterRuleSnapshotId UNIQUEIDENTIFIER NULL;
END;

IF EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE parent_object_id = OBJECT_ID('app.MetricSnapshots')
      AND name = 'FK_MetricSnapshots_PipelineRuns'
)
BEGIN
    ALTER TABLE app.MetricSnapshots DROP CONSTRAINT FK_MetricSnapshots_PipelineRuns;
END;

IF EXISTS (
    SELECT 1
    FROM sys.default_constraints
    WHERE parent_object_id = OBJECT_ID('app.MetricSnapshots')
      AND name = 'DF_MetricSnapshots_UpdateDate'
)
BEGIN
    ALTER TABLE app.MetricSnapshots DROP CONSTRAINT DF_MetricSnapshots_UpdateDate;
END;

IF COL_LENGTH('app.MetricSnapshots', 'PipelineRunId') IS NOT NULL
BEGIN
    ALTER TABLE app.MetricSnapshots DROP COLUMN PipelineRunId;
END;

IF COL_LENGTH('app.MetricSnapshots', 'DenominatorRevenue') IS NOT NULL
BEGIN
    ALTER TABLE app.MetricSnapshots DROP COLUMN DenominatorRevenue;
END;

IF COL_LENGTH('app.MetricSnapshots', 'NumeratorRevenue') IS NOT NULL
BEGIN
    ALTER TABLE app.MetricSnapshots DROP COLUMN NumeratorRevenue;
END;

IF COL_LENGTH('app.MetricSnapshots', 'MatchedRevenue') IS NOT NULL
BEGIN
    ALTER TABLE app.MetricSnapshots DROP COLUMN MatchedRevenue;
END;

IF COL_LENGTH('app.MetricSnapshots', 'RevenueCapturePct') IS NOT NULL
BEGIN
    ALTER TABLE app.MetricSnapshots DROP COLUMN RevenueCapturePct;
END;

IF COL_LENGTH('app.MetricSnapshots', 'UpdateDate') IS NOT NULL
BEGIN
    ALTER TABLE app.MetricSnapshots DROP COLUMN UpdateDate;
END;

IF COL_LENGTH('app.MetricSnapshots', 'UpdatedBy') IS NOT NULL
BEGIN
    ALTER TABLE app.MetricSnapshots DROP COLUMN UpdatedBy;
END;

IF EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('app.MetricSnapshots')
      AND name = 'RunId'
      AND is_nullable = 1
)
BEGIN
    DECLARE @runIdNullCount INT = 0;
    EXEC sp_executesql
        N'SELECT @nullCountOut = COUNT(1) FROM app.MetricSnapshots WHERE RunId IS NULL;',
        N'@nullCountOut INT OUTPUT',
        @nullCountOut = @runIdNullCount OUTPUT;

    IF @runIdNullCount = 0
    BEGIN
        ALTER TABLE app.MetricSnapshots
        ALTER COLUMN RunId UNIQUEIDENTIFIER NOT NULL;
    END;
END;

IF EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('app.MetricSnapshots')
      AND name = 'RevenuePct'
      AND is_nullable = 1
)
BEGIN
    DECLARE @revenuePctNullCount INT = 0;
    EXEC sp_executesql
        N'SELECT @nullCountOut = COUNT(1) FROM app.MetricSnapshots WHERE RevenuePct IS NULL;',
        N'@nullCountOut INT OUTPUT',
        @nullCountOut = @revenuePctNullCount OUTPUT;

    IF @revenuePctNullCount = 0
    BEGIN
        ALTER TABLE app.MetricSnapshots
        ALTER COLUMN RevenuePct DECIMAL(10, 4) NOT NULL;
    END;
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.default_constraints
    WHERE parent_object_id = OBJECT_ID('app.MetricSnapshots')
      AND name = 'DF_MetricSnapshots_MetricDefinitionVersion'
)
BEGIN
    ALTER TABLE app.MetricSnapshots
    ADD CONSTRAINT DF_MetricSnapshots_MetricDefinitionVersion DEFAULT (N'EPIC-007-v1') FOR MetricDefinitionVersion;
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.default_constraints
    WHERE parent_object_id = OBJECT_ID('app.MetricSnapshots')
      AND name = 'DF_MetricSnapshots_RefreshTimestamp'
)
BEGIN
    ALTER TABLE app.MetricSnapshots
    ADD CONSTRAINT DF_MetricSnapshots_RefreshTimestamp DEFAULT (SYSUTCDATETIME()) FOR RefreshTimestamp;
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE parent_object_id = OBJECT_ID('app.MetricSnapshots')
      AND name = 'FK_MetricSnapshots_RunId'
)
BEGIN
    ALTER TABLE app.MetricSnapshots
    ADD CONSTRAINT FK_MetricSnapshots_RunId
        FOREIGN KEY (RunId) REFERENCES app.PipelineRuns (RunId);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE parent_object_id = OBJECT_ID('app.MetricSnapshots')
      AND name = 'FK_MetricSnapshots_FilterRuleSnapshotId'
)
BEGIN
    ALTER TABLE app.MetricSnapshots
    ADD CONSTRAINT FK_MetricSnapshots_FilterRuleSnapshotId
        FOREIGN KEY (FilterRuleSnapshotId) REFERENCES app.FilterRuleSnapshots (SnapshotId);
END;

:r ..\stored-procedures\usp_CalculateMetrics.sql

:r ..\seed\seed-investment-dummy-facts.sql

