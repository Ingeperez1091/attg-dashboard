SET NOCOUNT ON;

-- Migration 030: Create stage.usp_RefreshDenominatorLocal
-- Purpose: Post-load type coercion, deduplication, and batch stamping
--          for denominator data copied by PL_DenomLoad_Weekly pipeline.

:r ..\stored-procedures\usp_RefreshDenominatorLocal.sql
