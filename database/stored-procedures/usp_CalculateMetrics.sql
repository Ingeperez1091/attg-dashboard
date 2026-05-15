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
    DECLARE @numeratorRevenue DECIMAL(18, 4) = 0;
    DECLARE @denominatorCount INT = 0;
    DECLARE @denominatorRevenue DECIMAL(18, 4) = 0;
    DECLARE @missingDistinctNumeratorKeys INT = 0;
    DECLARE @adoptionPct DECIMAL(10, 4) = 0;
    DECLARE @revenuePct DECIMAL(10, 4) = 0;
    DECLARE @avgEngagement DECIMAL(10, 4) = NULL;
    DECLARE @filterRuleSnapshotId UNIQUEIDENTIFIER = NULL;
    DECLARE @snapshotId UNIQUEIDENTIFIER = NEWID();
    DECLARE @isClientAdoption BIT = CASE
        WHEN LOWER(COALESCE(@adoptionLevel, '')) = 'client' THEN 1
        ELSE 0
    END;

    IF OBJECT_ID('tempdb..#FilteredDenom') IS NULL
    BEGIN
        THROW 51015, 'Filtered denominator temp table (#FilteredDenom) is required for metrics calculation.', 1;
    END;

        SELECT
                @numeratorCount = COUNT(DISTINCT mr.NumeratorKey),
                @matchedCount = COUNT(1)
        FROM app.MatchedRecords mr
        WHERE mr.PipelineRunId = @runId
            AND mr.ApplicationId = @applicationId;

        SELECT
                @denominatorCount = COUNT(DISTINCT CASE
                        WHEN @isClientAdoption = 1 THEN CAST(fd.ClientID AS NVARCHAR(256))
                        ELSE CAST(fd.EngagementID AS NVARCHAR(256))
                END)
        FROM #FilteredDenom fd
        WHERE CASE
                        WHEN @isClientAdoption = 1 THEN CAST(fd.ClientID AS NVARCHAR(256))
                        ELSE CAST(fd.EngagementID AS NVARCHAR(256))
                    END IS NOT NULL
            AND LTRIM(RTRIM(CASE
                        WHEN @isClientAdoption = 1 THEN CAST(fd.ClientID AS NVARCHAR(256))
                        ELSE CAST(fd.EngagementID AS NVARCHAR(256))
                    END)) <> '';

        SELECT @missingDistinctNumeratorKeys = COUNT(DISTINCT vr.RecordKey)
        FROM app.ValidationResults vr
        WHERE vr.PipelineRunId = @runId
            AND vr.ApplicationId = @applicationId
            AND vr.Status = 'Valid'
            AND NOT EXISTS (
                    SELECT 1
                    FROM #FilteredDenom fd
                    WHERE (
                                @isClientAdoption = 1
                        AND CAST(fd.ClientID AS NVARCHAR(256)) = vr.RecordKey
                    )
                    OR (
                                @isClientAdoption = 0
                        AND CAST(fd.EngagementID AS NVARCHAR(256)) = vr.RecordKey
                    )
            );

        IF @missingDistinctNumeratorKeys > 0
        BEGIN
                THROW 51016, 'Validation detected distinct numerator keys that are not present in the filtered denominator.', 1;
        END;

    DECLARE @denomRevenueSql NVARCHAR(MAX) = N'
        SELECT @sumOut = COALESCE(SUM(TRY_CONVERT(DECIMAL(18,4), fd.' + QUOTENAME(@revenueMetric) + N')), 0)
        FROM #FilteredDenom fd;';

    EXEC sp_executesql
        @denomRevenueSql,
        N'@sumOut DECIMAL(18,4) OUTPUT',
        @sumOut = @denominatorRevenue OUTPUT;

    -- Sum ALL numerator revenue amounts, including duplicate keys
    SELECT @numeratorRevenue = COALESCE(SUM(COALESCE(mr.RevenueAmount, 0)), 0)
    FROM app.MatchedRecords mr
    WHERE mr.PipelineRunId = @runId
      AND mr.ApplicationId = @applicationId;

    -- Calculate adoption percentage (engagement metric)
    -- Formula: engagement = Math.max(0, Math.min(100, adoptionPercent))
    DECLARE @rawAdoptionPct DECIMAL(10, 4) =
        CASE
            WHEN NULLIF(@denominatorCount, 0) IS NULL THEN 0
            ELSE ROUND((CAST(@numeratorCount AS DECIMAL(18, 6)) / CAST(@denominatorCount AS DECIMAL(18, 6))) * 100, 4)
        END;
    
    SET @adoptionPct = CASE
        WHEN @rawAdoptionPct < 0 THEN CAST(0 AS DECIMAL(10, 4))
        WHEN @rawAdoptionPct > 100 THEN CAST(100 AS DECIMAL(10, 4))
        ELSE @rawAdoptionPct
    END;

    -- Calculate revenue percentage (revenue share metric)
    -- Formula: revenueShare = Math.max(0, Math.min(100, revenuePct))
    DECLARE @rawRevenuePct DECIMAL(10, 4) =
        CASE
            WHEN NULLIF(@denominatorRevenue, 0) IS NULL THEN 0
            ELSE ROUND((@numeratorRevenue / @denominatorRevenue) * 100, 4)
        END;
    
    SET @revenuePct = CASE
        WHEN @rawRevenuePct < 0 THEN CAST(0 AS DECIMAL(10, 4))
        WHEN @rawRevenuePct > 100 THEN CAST(100 AS DECIMAL(10, 4))
        ELSE @rawRevenuePct
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
        DenominatorRevenue,
        NumeratorRevenue,
        RevenuePct,
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
        @denominatorRevenue,
        @numeratorRevenue,
        @revenuePct,
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
