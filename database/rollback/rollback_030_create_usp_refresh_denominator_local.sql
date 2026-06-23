SET NOCOUNT ON;

-- Rollback 030: Drop stage.usp_RefreshDenominatorLocal
IF OBJECT_ID('stage.usp_RefreshDenominatorLocal', 'P') IS NOT NULL
    DROP PROCEDURE stage.usp_RefreshDenominatorLocal;
