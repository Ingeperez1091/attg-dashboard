SET NOCOUNT ON;

-- ============================================================
-- Migration 035: ALTER usp_BuildFilteredDenominator — Preview session branch
-- Purpose: When @previewSessionId IS NOT NULL, read rules from
--          stage.DenominatorFilterRulesPreview instead of committed rules.
--          This is the core Option D change.
-- ============================================================

:r ..\stored-procedures\usp_BuildFilteredDenominator.sql