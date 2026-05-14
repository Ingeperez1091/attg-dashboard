SET NOCOUNT ON;

IF OBJECT_ID('stage.EngagementUsageRaw', 'U') IS NULL THROW 51000, 'Missing stage.EngagementUsageRaw', 1;

IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'stage'
      AND TABLE_NAME = 'EngagementUsageRaw'
      AND COLUMN_NAME = 'PayloadJson'
      AND DATA_TYPE = 'nvarchar'
)
    THROW 51000, 'PayloadJson nvarchar column missing', 1;

IF EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA='stage' AND TABLE_NAME='EngagementUsageRaw' AND COLUMN_NAME IN ('UpdateDate','UpdatedBy')
)
    THROW 51000, 'Staging table must be append-only (no UpdateDate/UpdatedBy)', 1;

SELECT 'US2 contract checks passed' AS Result;
