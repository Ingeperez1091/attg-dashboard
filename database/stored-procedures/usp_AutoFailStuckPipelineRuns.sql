IF OBJECT_ID('app.usp_AutoFailStuckPipelineRuns', 'P') IS NOT NULL
BEGIN
    DROP PROCEDURE app.usp_AutoFailStuckPipelineRuns;
END;
GO

CREATE PROCEDURE app.usp_AutoFailStuckPipelineRuns
    @ThresholdMinutes INT = 30,
    @BatchSize INT = 100
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @CutoffUtc DATETIME2(7) = DATEADD(MINUTE, -@ThresholdMinutes, SYSUTCDATETIME());
    DECLARE @FailedCount INT = 0;

    -- Update stuck runs in a single batched statement
    UPDATE TOP (@BatchSize) app.PipelineRuns
    SET Status = 'Failed',
        ErrorMessage = CONCAT('Auto-failed by SQL Agent: exceeded ', @ThresholdMinutes, '-minute threshold (FR-010a)'),
        EndTime = SYSUTCDATETIME(),
        UpdateDate = SYSUTCDATETIME(),
        UpdatedBy = 'SYSTEM_AGENT'
    WHERE Status IN ('Queued', 'Processing')
      AND CreateDate < @CutoffUtc;

    SET @FailedCount = @@ROWCOUNT;

    -- Return summary
    SELECT @FailedCount AS RunsAutoFailed,
           @CutoffUtc AS CutoffTimestampUtc,
           @ThresholdMinutes AS ThresholdMinutes;
END;
GO
