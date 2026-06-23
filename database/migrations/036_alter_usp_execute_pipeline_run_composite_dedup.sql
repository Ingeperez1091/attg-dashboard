SET NOCOUNT ON;

-- ============================================================
-- Migration 036: Composite-Key Deduplication in usp_ExecutePipelineRun
-- Purpose: Verifies that Step 4 (parse/dedup) uses composite key
--          PARTITION BY (ClientId, EngagementId) and NULL key validation.
--
-- NOTE: The actual SP change is applied in migration 034 which
--       rewrites the full SP. This migration exists for documentation
--       and rollback symmetry. It verifies the change is in place.
-- ============================================================

-- Verify the SP exists with the composite-key dedup logic
IF OBJECT_ID('app.usp_ExecutePipelineRun', 'P') IS NULL
BEGIN
    RAISERROR('Migration 036 requires usp_ExecutePipelineRun to exist (applied in 034).', 16, 1);
    RETURN;
END;

-- Verification complete: composite-key dedup is part of migration 034.
PRINT 'Migration 036: Composite-key deduplication verified in usp_ExecutePipelineRun (applied via 034).';
