SET NOCOUNT ON;

IF (SELECT COUNT(*) FROM app.ApplicationModelFields WHERE IsActive = 1) <> 32
    THROW 51000, 'Expected 32 active seeded application model fields.', 1;

IF (SELECT COUNT(*) FROM app.ApplicationModelFields WHERE ApplicationId = '10000000-0000-0000-0000-000000000001' AND IsActive = 1) <> 5
    THROW 51000, 'Expected Maestro to have 5 active fields.', 1;

IF (SELECT COUNT(*) FROM app.ApplicationModelFields WHERE ApplicationId = '10000000-0000-0000-0000-000000000002' AND IsActive = 1) <> 7
    THROW 51000, 'Expected EYST to have 7 active fields.', 1;

IF (SELECT COUNT(*) FROM app.ApplicationModelFields WHERE ApplicationId = '10000000-0000-0000-0000-000000000003' AND IsActive = 1) <> 7
    THROW 51000, 'Expected Prodigy to have 7 active fields.', 1;

IF (SELECT COUNT(*) FROM app.ApplicationModelFields WHERE ApplicationId = '10000000-0000-0000-0000-000000000004' AND IsActive = 1) <> 6
    THROW 51000, 'Expected Vector to have 6 active fields.', 1;

IF (SELECT COUNT(*) FROM app.ApplicationModelFields WHERE ApplicationId = '10000000-0000-0000-0000-000000000005' AND IsActive = 1) <> 7
    THROW 51000, 'Expected Navigate to have 7 active fields.', 1;

IF (SELECT COUNT(*) FROM app.ApplicationModelFields WHERE ApplicationId = '10000000-0000-0000-0000-000000000001' AND IsFilterable = 1 AND IsActive = 1) <> 2
    THROW 51000, 'Expected Maestro to have 2 filterable fields.', 1;

IF (SELECT COUNT(*) FROM app.ApplicationModelFields WHERE ApplicationId = '10000000-0000-0000-0000-000000000002' AND IsFilterable = 1 AND IsActive = 1) <> 4
    THROW 51000, 'Expected EYST to have 4 filterable fields.', 1;

IF (SELECT COUNT(*) FROM app.ApplicationModelFields WHERE ApplicationId = '10000000-0000-0000-0000-000000000003' AND IsFilterable = 1 AND IsActive = 1) <> 3
    THROW 51000, 'Expected Prodigy to have 3 filterable fields.', 1;

IF (SELECT COUNT(*) FROM app.ApplicationModelFields WHERE ApplicationId = '10000000-0000-0000-0000-000000000004' AND IsFilterable = 1 AND IsActive = 1) <> 4
    THROW 51000, 'Expected Vector to have 4 filterable fields.', 1;

IF (SELECT COUNT(*) FROM app.ApplicationModelFields WHERE ApplicationId = '10000000-0000-0000-0000-000000000005' AND IsFilterable = 1 AND IsActive = 1) <> 2
    THROW 51000, 'Expected Navigate to have 2 filterable fields.', 1;

IF EXISTS (
    SELECT ApplicationId
    FROM app.ApplicationModelFields
    WHERE IsActive = 1
      AND IsMetricDimension = 1
    GROUP BY ApplicationId
    HAVING COUNT(*) <> 1
)
    THROW 51000, 'Expected exactly one active metric-dimension field per application.', 1;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'UQ_ApplicationModelFields_OneMetricDimensionPerApp'
      AND object_id = OBJECT_ID('app.ApplicationModelFields')
)
    THROW 51000, 'Expected unique filtered index for one metric-dimension field per application.', 1;

SELECT 'Numerator filter config seed contract checks passed' AS Result;
