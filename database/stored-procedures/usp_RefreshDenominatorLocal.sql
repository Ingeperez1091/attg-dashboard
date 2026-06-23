IF OBJECT_ID('stage.usp_RefreshDenominatorLocal', 'P') IS NOT NULL
BEGIN
    DROP PROCEDURE stage.usp_RefreshDenominatorLocal;
END;
GO

-- ============================================================
-- stage.usp_RefreshDenominatorLocal
-- 
-- Purpose: Post-load cleansing of stage.DenominatorSnapshot rows
--          after the ADF copy activity inserts raw data from the
--          external Mercury view.
--
-- Responsibilities:
--   1. Safe type coercion (numeric columns that arrive as strings)
--   2. Deduplication (same EngagementID appearing multiple times)
--   3. Stamp LoadDate on all rows in the current batch
--
-- Called by: PL_DenomLoad_Weekly (ADF pipeline, Step 2)
-- Depends on: stage.DenominatorSnapshot table populated by Copy Activity
-- Downstream: app.vw_DenominatorLocal (passthrough view, auto-refreshes)
-- ============================================================
CREATE PROCEDURE stage.usp_RefreshDenominatorLocal
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @batchLoadDate DATETIME2 = SYSUTCDATETIME();
    DECLARE @rowsBefore INT;
    DECLARE @rowsAfter INT;
    DECLARE @duplicatesRemoved INT;
    DECLARE @coercionFailures INT;

    -- ============================================================
    -- 1) Stamp LoadDate for the current batch
    --    Rows inserted by ADF Copy get the default SYSUTCDATETIME(),
    --    but we normalize to a single consistent batch timestamp.
    -- ============================================================
    UPDATE stage.DenominatorSnapshot
    SET LoadDate = @batchLoadDate,
        UpdateDate = @batchLoadDate,
        UpdatedBy = 'usp_RefreshDenominatorLocal'
    WHERE LoadDate > DATEADD(MINUTE, -5, @batchLoadDate);

    SELECT @rowsBefore = COUNT(1) FROM stage.DenominatorSnapshot;

    -- ============================================================
    -- 2) Type coercion — safe numeric casting
    --    If source sends string representations that don't parse,
    --    set the value to NULL rather than failing the pipeline.
    -- ============================================================
    UPDATE stage.DenominatorSnapshot
    SET ETD_ANSRAmt = NULL
    WHERE TRY_CAST(ETD_ANSRAmt AS DECIMAL(18, 2)) IS NULL
      AND ETD_ANSRAmt IS NOT NULL;

    UPDATE stage.DenominatorSnapshot
    SET FYTD_ANSRAmt = NULL
    WHERE TRY_CAST(FYTD_ANSRAmt AS DECIMAL(18, 2)) IS NULL
      AND FYTD_ANSRAmt IS NOT NULL;

    UPDATE stage.DenominatorSnapshot
    SET ETD_TERAmt = NULL
    WHERE TRY_CAST(ETD_TERAmt AS DECIMAL(18, 2)) IS NULL
      AND ETD_TERAmt IS NOT NULL;

    UPDATE stage.DenominatorSnapshot
    SET FYTD_TERAmt = NULL
    WHERE TRY_CAST(FYTD_TERAmt AS DECIMAL(18, 2)) IS NULL
      AND FYTD_TERAmt IS NOT NULL;

    UPDATE stage.DenominatorSnapshot
    SET ETD_ChargedHours = NULL
    WHERE TRY_CAST(ETD_ChargedHours AS DECIMAL(18, 2)) IS NULL
      AND ETD_ChargedHours IS NOT NULL;

    UPDATE stage.DenominatorSnapshot
    SET FYTD_ChargedHours = NULL
    WHERE TRY_CAST(FYTD_ChargedHours AS DECIMAL(18, 2)) IS NULL
      AND FYTD_ChargedHours IS NOT NULL;

    -- Count rows that had at least one coercion failure (informational)
    -- This runs after corrections, so we check for NULLs that weren't NULL in source.
    -- For now, log the count via PRINT (captured by ADF activity output).
    SET @coercionFailures = @@ROWCOUNT;

    -- ============================================================
    -- 3) Deduplication
    --    Keep only the most recent row per EngagementID.
    --    "Most recent" = highest SnapshotId (latest insert).
    --    If EngagementID is NULL, keep all rows (cannot deduplicate).
    -- ============================================================
    ;WITH Duplicates AS (
        SELECT
            SnapshotId,
            ROW_NUMBER() OVER (
                PARTITION BY EngagementID
                ORDER BY SnapshotId DESC
            ) AS RowRank
        FROM stage.DenominatorSnapshot
        WHERE EngagementID IS NOT NULL
    )
    DELETE FROM Duplicates
    WHERE RowRank > 1;

    SET @duplicatesRemoved = @@ROWCOUNT;

    SELECT @rowsAfter = COUNT(1) FROM stage.DenominatorSnapshot;

    -- ============================================================
    -- 4) Output summary (captured by ADF stored procedure activity)
    -- ============================================================
    SELECT
        @rowsBefore AS RowsBeforeCleansing,
        @rowsAfter AS RowsAfterCleansing,
        @duplicatesRemoved AS DuplicatesRemoved,
        @coercionFailures AS CoercionUpdates,
        @batchLoadDate AS BatchLoadDate;

    PRINT CONCAT(
        'usp_RefreshDenominatorLocal complete. ',
        'Before: ', @rowsBefore, ', ',
        'After: ', @rowsAfter, ', ',
        'Duplicates removed: ', @duplicatesRemoved, ', ',
        'Batch: ', CONVERT(NVARCHAR(30), @batchLoadDate, 126)
    );
END;
GO
