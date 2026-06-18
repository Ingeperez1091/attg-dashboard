-- Rollback 039: Drop defense-in-depth cleanup stored procedures
IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'stage.usp_PurgeExpiredPreviewRules') AND type = 'P')
    DROP PROCEDURE stage.usp_PurgeExpiredPreviewRules;
GO

IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'app.usp_AutoFailStuckPipelineRuns') AND type = 'P')
    DROP PROCEDURE app.usp_AutoFailStuckPipelineRuns;
GO

PRINT 'Rolled back migration 039: Dropped defense-in-depth cleanup stored procedures';
GO
