SET NOCOUNT ON;

-- ============================================================
-- Migration 031: Create stage.DenominatorFilterRulesPreview
-- Purpose: Session-scoped transient staging table for proposed
--          denominator rules during impact preview (Option D).
-- ============================================================

:r ..\schema\stage\DenominatorFilterRulesPreview.sql

-- Covering index for SP rule load (session + application lookup)
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_DenominatorFilterRulesPreview_Session_App'
      AND object_id = OBJECT_ID('stage.DenominatorFilterRulesPreview')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_DenominatorFilterRulesPreview_Session_App
        ON stage.DenominatorFilterRulesPreview (SessionId, ApplicationId)
        INCLUDE (DenominatorModelId, Operator, Value, RuleOrder);
END;

-- Index for TTL cleanup job (ExpiresAt scan)
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_DenominatorFilterRulesPreview_ExpiresAt'
      AND object_id = OBJECT_ID('stage.DenominatorFilterRulesPreview')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_DenominatorFilterRulesPreview_ExpiresAt
        ON stage.DenominatorFilterRulesPreview (ExpiresAt);
END;
