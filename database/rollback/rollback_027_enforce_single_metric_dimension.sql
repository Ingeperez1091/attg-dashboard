SET NOCOUNT ON;

IF EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'UQ_ApplicationModelFields_OneMetricDimensionPerApp'
      AND object_id = OBJECT_ID('app.ApplicationModelFields')
)
BEGIN
    DROP INDEX UQ_ApplicationModelFields_OneMetricDimensionPerApp
        ON app.ApplicationModelFields;
END;

-- Note: the migration normalized legacy data to one metric-dimension field per app.
-- This rollback removes the uniqueness enforcement only; it does not attempt to
-- reconstruct prior IsMetricDimension values that were collapsed during normalization.