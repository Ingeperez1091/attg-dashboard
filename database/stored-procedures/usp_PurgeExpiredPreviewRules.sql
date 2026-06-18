IF OBJECT_ID('stage.usp_PurgeExpiredPreviewRules', 'P') IS NOT NULL
BEGIN
    DROP PROCEDURE stage.usp_PurgeExpiredPreviewRules;
END;
GO

CREATE PROCEDURE stage.usp_PurgeExpiredPreviewRules
    @BatchSize INT = 5000
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @DeletedCount INT = 0;
    DECLARE @BatchDeleted INT = 1;

    -- Delete expired staged rules in batches to avoid lock escalation
    -- at scale (200+ apps generating concurrent preview sessions)
    WHILE @BatchDeleted > 0
    BEGIN
        DELETE TOP (@BatchSize)
        FROM stage.DenominatorFilterRulesPreview
        WHERE ExpiresAt < SYSUTCDATETIME();

        SET @BatchDeleted = @@ROWCOUNT;
        SET @DeletedCount = @DeletedCount + @BatchDeleted;
    END;

    -- Return summary
    SELECT @DeletedCount AS RowsPurged,
           SYSUTCDATETIME() AS ExecutedAtUtc;
END;
GO
