SET NOCOUNT ON;

-- Rollback 031: Drop stage.DenominatorFilterRulesPreview
IF OBJECT_ID('stage.DenominatorFilterRulesPreview', 'U') IS NOT NULL
    DROP TABLE stage.DenominatorFilterRulesPreview;
