SET NOCOUNT ON;

:r ..\schema\app\DenominatorModels.sql

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_DenominatorModels_DisplayOrder'
      AND object_id = OBJECT_ID('app.DenominatorModels')
)
BEGIN
    CREATE INDEX IX_DenominatorModels_DisplayOrder
        ON app.DenominatorModels (DisplayOrder)
        INCLUDE (FieldName, FieldType, IsFilterable, IsActive);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_DenominatorModels_Filterable'
      AND object_id = OBJECT_ID('app.DenominatorModels')
)
BEGIN
    CREATE INDEX IX_DenominatorModels_Filterable
        ON app.DenominatorModels (IsFilterable, IsActive)
        INCLUDE (FieldName, FieldType, DisplayOrder);
END;
