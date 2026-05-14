SET NOCOUNT ON;

-- Normalize legacy data before enforcing uniqueness: keep one active metric field per app.
;WITH ranked_metric_fields AS (
    SELECT
        ApplicationModelFieldId,
        ROW_NUMBER() OVER (
            PARTITION BY ApplicationId
            ORDER BY
                CASE WHEN FieldType = 'numeric' THEN 0 ELSE 1 END,
                DisplayOrder,
                ApplicationModelFieldId
        ) AS MetricRank
    FROM app.ApplicationModelFields
    WHERE IsActive = 1
      AND IsMetricDimension = 1
)
UPDATE amf
SET
    IsMetricDimension = CASE WHEN rmf.MetricRank = 1 THEN 1 ELSE 0 END,
    UpdateDate = SYSUTCDATETIME(),
    UpdatedBy = SUSER_SNAME()
FROM app.ApplicationModelFields amf
INNER JOIN ranked_metric_fields rmf ON rmf.ApplicationModelFieldId = amf.ApplicationModelFieldId
WHERE rmf.MetricRank > 1;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'UQ_ApplicationModelFields_OneMetricDimensionPerApp'
      AND object_id = OBJECT_ID('app.ApplicationModelFields')
)
BEGIN
    CREATE UNIQUE INDEX UQ_ApplicationModelFields_OneMetricDimensionPerApp
        ON app.ApplicationModelFields (ApplicationId)
        WHERE IsActive = 1 AND IsMetricDimension = 1;
END;
