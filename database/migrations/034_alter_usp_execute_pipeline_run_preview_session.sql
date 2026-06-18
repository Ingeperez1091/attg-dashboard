SET NOCOUNT ON;

-- ============================================================
-- Migration 034: ALTER usp_ExecutePipelineRun — Add @previewSessionId
-- Purpose: Pass @previewSessionId to usp_BuildFilteredDenominator
--          so the SP can source rules from staging table during preview.
-- ============================================================

:r ..\stored-procedures\usp_ExecutePipelineRun.sql