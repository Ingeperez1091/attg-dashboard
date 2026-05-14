SET NOCOUNT ON;

:r ..\schema\app\ApplicationModelFields.sql

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_ApplicationModelFields_Application_DisplayOrder'
      AND object_id = OBJECT_ID('app.ApplicationModelFields')
)
BEGIN
    CREATE INDEX IX_ApplicationModelFields_Application_DisplayOrder
        ON app.ApplicationModelFields (ApplicationId, DisplayOrder)
        INCLUDE (FieldName, FieldType, IsActive, IsFilterable, IsMetricDimension);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_ApplicationModelFields_Application_Filterable'
      AND object_id = OBJECT_ID('app.ApplicationModelFields')
)
BEGIN
    CREATE INDEX IX_ApplicationModelFields_Application_Filterable
        ON app.ApplicationModelFields (ApplicationId, IsFilterable)
        INCLUDE (FieldName, FieldType, DisplayOrder, IsActive);
END;
