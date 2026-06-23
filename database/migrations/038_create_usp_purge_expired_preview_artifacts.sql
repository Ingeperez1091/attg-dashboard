-- Migration 038: Create 24-Hour Retention Purge Stored Procedure for Preview Artifacts
-- Purpose: FR-008 — Delete preview-tagged pipeline run artifacts older than 24 hours
-- Execution: Intended to run via SQL Agent job on a recurring schedule (every hour)
-- Safety: Only affects rows WHERE TriggerSource = 'Preview' — production data is never touched.

:r ..\stored-procedures\usp_PurgeExpiredPreviewArtifacts.sql

PRINT 'Created app.usp_PurgeExpiredPreviewArtifacts';
GO