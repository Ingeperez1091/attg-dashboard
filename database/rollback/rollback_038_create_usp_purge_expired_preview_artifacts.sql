-- Rollback 038: Drop 24-hour retention purge stored procedure
IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'app.usp_PurgeExpiredPreviewArtifacts') AND type = 'P')
    DROP PROCEDURE app.usp_PurgeExpiredPreviewArtifacts;
GO

PRINT 'Rolled back migration 038: Dropped app.usp_PurgeExpiredPreviewArtifacts';
GO
