SET NOCOUNT ON;

IF OBJECT_ID('app.usp_CalculateMetrics', 'P') IS NOT NULL
BEGIN
    DROP PROCEDURE app.usp_CalculateMetrics;
END;
GO

CREATE PROCEDURE app.usp_CalculateMetrics
    @runId UNIQUEIDENTIFIER,
    @applicationId UNIQUEIDENTIFIER,
    @actorUserId NVARCHAR(128),
    @sourceBatchId NVARCHAR(256) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @adoptionLevel NVARCHAR(32);
    DECLARE @revenueMetric NVARCHAR(64);

    SELECT TOP (1)
        @adoptionLevel = AdoptionLevel,
        @revenueMetric = RevenueMetric
    FROM app.AdoptionSettings
    WHERE ApplicationId = @applicationId;

    IF @adoptionLevel IS NULL OR @revenueMetric IS NULL
    BEGIN
        THROW 51010, 'No active adoption settings found for the application.', 1;
    END;

    IF @revenueMetric NOT IN (
        'ETD_ANSRAmt', 'FYTD_ANSRAmt', 'ETD_TERAmt', 'FYTD_TERAmt', 'ETD_ChargedHours', 'FYTD_ChargedHours'
    )
    BEGIN
        THROW 51011, 'Unsupported RevenueMetric value in app.AdoptionSettings.', 1;
    END;

    DECLARE @numeratorCount INT = 0;
    DECLARE @matchedCount INT = 0;
    DECLARE @matchedRevenue DECIMAL(18, 4) = 0;
    DECLARE @denominatorCount INT = 0;
    DECLARE @denominatorRevenue DECIMAL(18, 4) = 0;
    DECLARE @adoptionPct DECIMAL(10, 4) = 0;
    DECLARE @revenuePct DECIMAL(10, 4) = 0;
    DECLARE @onTargetRate DECIMAL(10, 4) = NULL;
    DECLARE @avgEngagement DECIMAL(10, 4) = NULL;
    DECLARE @filterRuleSnapshotId UNIQUEIDENTIFIER = NULL;
    DECLARE @snapshotId UNIQUEIDENTIFIER = NEWID();

    SELECT @numeratorCount = COUNT(1)
    FROM app.ValidationResults
    WHERE PipelineRunId = @runId
      AND ApplicationId = @applicationId
      AND Status = 'Valid';

    SELECT
        @matchedCount = COUNT(1),
        @matchedRevenue = COALESCE(SUM(TRY_CONVERT(DECIMAL(18, 4), RevenueAmount)), 0)
    FROM app.MatchedRecords
    WHERE PipelineRunId = @runId
      AND ApplicationId = @applicationId;

    IF OBJECT_ID('tempdb..#FilteredDenom') IS NOT NULL
    BEGIN
        SELECT @denominatorCount = COUNT(1) FROM #FilteredDenom;

        DECLARE @denomFromTempSql NVARCHAR(MAX) = N'
            SELECT @sumOut = COALESCE(SUM(TRY_CONVERT(DECIMAL(18,4), ' + QUOTENAME(@revenueMetric) + N')), 0)
            FROM #FilteredDenom;';

        EXEC sp_executesql
            @denomFromTempSql,
            N'@sumOut DECIMAL(18,4) OUTPUT',
            @sumOut = @denominatorRevenue OUTPUT;
    END
    ELSE
    BEGIN
        SELECT @denominatorCount = COUNT(1)
        FROM app.vw_DenominatorLocal;

        DECLARE @denomFromViewSql NVARCHAR(MAX) = N'
            SELECT @sumOut = COALESCE(SUM(TRY_CONVERT(DECIMAL(18,4), ' + QUOTENAME(@revenueMetric) + N')), 0)
            FROM app.vw_DenominatorLocal;';

        EXEC sp_executesql
            @denomFromViewSql,
            N'@sumOut DECIMAL(18,4) OUTPUT',
            @sumOut = @denominatorRevenue OUTPUT;
    END;

    SET @adoptionPct =
        CASE
            WHEN NULLIF(@denominatorCount, 0) IS NULL THEN 0
            ELSE ROUND((CAST(@matchedCount AS DECIMAL(18, 6)) / CAST(@denominatorCount AS DECIMAL(18, 6))) * 100, 4)
        END;

    SET @revenuePct =
        CASE
            WHEN NULLIF(@denominatorRevenue, 0) IS NULL THEN 0
            ELSE ROUND((@matchedRevenue / @denominatorRevenue) * 100, 4)
        END;

    SELECT TOP (1)
        @filterRuleSnapshotId = SnapshotId
    FROM app.FilterRuleSnapshots
    WHERE PipelineRunId = @runId
      AND RuleType = 'Denominator'
    ORDER BY CreateDate DESC;

    IF EXISTS (
        SELECT 1
        FROM app.MetricSnapshots
        WHERE RunId = @runId
    )
    BEGIN
        THROW 51013, 'Metric snapshot already exists for this pipeline run.', 1;
    END;

    INSERT INTO app.MetricSnapshots
    (
        SnapshotId,
        RunId,
        ApplicationId,
        CalculationDate,
        DenominatorCount,
        NumeratorCount,
        MatchedCount,
        AdoptionPct,
        RevenuePct,
        OnTargetRate,
        AvgEngagement,
        MetricDefinitionVersion,
        RefreshTimestamp,
        SourceBatchId,
        FilterRuleSnapshotId,
        CreateDate,
        CreatedBy
    )
    VALUES
    (
        @snapshotId,
        @runId,
        @applicationId,
        SYSUTCDATETIME(),
        @denominatorCount,
        @numeratorCount,
        @matchedCount,
        @adoptionPct,
        @revenuePct,
        @onTargetRate,
        @avgEngagement,
        N'EPIC-007-v1',
        SYSUTCDATETIME(),
        @sourceBatchId,
        @filterRuleSnapshotId,
        SYSUTCDATETIME(),
        @actorUserId
    );

    IF @@ROWCOUNT <> 1
    BEGIN
        THROW 51012, 'Metric snapshot insert did not persist exactly one row.', 1;
    END;
END;
GO