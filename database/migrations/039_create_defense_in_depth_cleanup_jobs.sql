-- Migration 039: Create Defense-in-Depth Cleanup Stored Procedures
-- Purpose: (a) FR-010a — Auto-fail PipelineRuns stuck > 30min in Queued/Processing
--          (b) FR-001d — Purge orphaned staged preview rules past ExpiresAt TTL
-- Execution: Intended to run via SQL Agent jobs every 15 minutes
-- Safety: Only affects stuck/orphaned records — active processing is never interrupted.

:r ..\stored-procedures\usp_AutoFailStuckPipelineRuns.sql

PRINT 'Created app.usp_AutoFailStuckPipelineRuns';
GO

:r ..\stored-procedures\usp_PurgeExpiredPreviewRules.sql

PRINT 'Created stage.usp_PurgeExpiredPreviewRules';
GO