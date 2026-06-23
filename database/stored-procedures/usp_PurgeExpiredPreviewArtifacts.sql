IF OBJECT_ID('app.usp_PurgeExpiredPreviewArtifacts', 'P') IS NOT NULL
BEGIN
    DROP PROCEDURE app.usp_PurgeExpiredPreviewArtifacts;
END;
GO

CREATE PROCEDURE app.usp_PurgeExpiredPreviewArtifacts
    @RetentionHours INT = 24,
    @BatchSize INT = 1000
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @CutoffUtc DATETIME2(7) = DATEADD(HOUR, -@RetentionHours, SYSUTCDATETIME());
    DECLARE @DeletedRuns TABLE (RunId UNIQUEIDENTIFIER);
    DECLARE @TotalDeleted INT = 0;
    DECLARE @BatchDeleted INT = 1;

    -- Identify expired preview runs
    INSERT INTO @DeletedRuns (RunId)
    SELECT RunId
    FROM app.PipelineRuns
    WHERE TriggerSource = 'Preview'
      AND CreateDate < @CutoffUtc
      AND Status IN ('Completed', 'Failed');

    -- Delete in batches to avoid lock escalation at scale (>200 apps)
    -- Order: child tables first, then parent PipelineRuns

    -- 1. Delete FilterRuleSnapshots for expired preview runs
    WHILE @BatchDeleted > 0
    BEGIN
        DELETE TOP (@BatchSize) frs
        FROM app.FilterRuleSnapshots frs
        INNER JOIN @DeletedRuns dr ON frs.PipelineRunId = dr.RunId;

        SET @BatchDeleted = @@ROWCOUNT;
        SET @TotalDeleted = @TotalDeleted + @BatchDeleted;
    END;

    -- 2. Delete ValidationResults for expired preview runs
    SET @BatchDeleted = 1;
    WHILE @BatchDeleted > 0
    BEGIN
        DELETE TOP (@BatchSize) vr
        FROM app.ValidationResults vr
        INNER JOIN @DeletedRuns dr ON vr.PipelineRunId = dr.RunId;

        SET @BatchDeleted = @@ROWCOUNT;
        SET @TotalDeleted = @TotalDeleted + @BatchDeleted;
    END;

    -- 3. Delete MatchedRecords for expired preview runs
    SET @BatchDeleted = 1;
    WHILE @BatchDeleted > 0
    BEGIN
        DELETE TOP (@BatchSize) mr
        FROM app.MatchedRecords mr
        INNER JOIN @DeletedRuns dr ON mr.PipelineRunId = dr.RunId;

        SET @BatchDeleted = @@ROWCOUNT;
        SET @TotalDeleted = @TotalDeleted + @BatchDeleted;
    END;

    -- 4. Delete MetricSnapshots for expired preview runs
    SET @BatchDeleted = 1;
    WHILE @BatchDeleted > 0
    BEGIN
        DELETE TOP (@BatchSize) ms
        FROM app.MetricSnapshots ms
        INNER JOIN @DeletedRuns dr ON ms.RunId = dr.RunId;

        SET @BatchDeleted = @@ROWCOUNT;
        SET @TotalDeleted = @TotalDeleted + @BatchDeleted;
    END;

    -- 5. Delete PipelineRuns themselves
    SET @BatchDeleted = 1;
    WHILE @BatchDeleted > 0
    BEGIN
        DELETE TOP (@BatchSize) pr
        FROM app.PipelineRuns pr
        INNER JOIN @DeletedRuns dr ON pr.RunId = dr.RunId;

        SET @BatchDeleted = @@ROWCOUNT;
        SET @TotalDeleted = @TotalDeleted + @BatchDeleted;
    END;

    -- Return summary
    SELECT @TotalDeleted AS TotalRowsDeleted,
           (SELECT COUNT(*) FROM @DeletedRuns) AS RunsPurged,
           @CutoffUtc AS CutoffTimestampUtc;
END;
GO
