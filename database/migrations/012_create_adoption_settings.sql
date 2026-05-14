SET NOCOUNT ON;

:r ..\schema\app\AdoptionSettings.sql

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_AdoptionSettings_Application'
      AND object_id = OBJECT_ID('app.AdoptionSettings')
)
BEGIN
    CREATE INDEX IX_AdoptionSettings_Application
        ON app.AdoptionSettings (ApplicationId)
        INCLUDE (AdoptionLevel, RevenueMetric, NumeratorSource, UpdateDate, UpdatedBy);
END;
