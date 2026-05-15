SET NOCOUNT ON;

:r ..\schema\app\DenominatorFilterRules.sql

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_DenominatorFilterRules_Application_Active_Order'
      AND object_id = OBJECT_ID('app.DenominatorFilterRules')
)
BEGIN
    CREATE INDEX IX_DenominatorFilterRules_Application_Active_Order
        ON app.DenominatorFilterRules (ApplicationId, IsActive, RuleOrder)
        INCLUDE (DenominatorModelId, Operator, Value, UpdateDate, UpdatedBy);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_DenominatorFilterRules_Model'
      AND object_id = OBJECT_ID('app.DenominatorFilterRules')
)
BEGIN
    CREATE INDEX IX_DenominatorFilterRules_Model
        ON app.DenominatorFilterRules (DenominatorModelId, IsActive)
        INCLUDE (ApplicationId, RuleOrder, Operator);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'UQ_DenominatorFilterRules_ActiveOrder'
      AND object_id = OBJECT_ID('app.DenominatorFilterRules')
)
BEGIN
    CREATE UNIQUE INDEX UQ_DenominatorFilterRules_ActiveOrder
        ON app.DenominatorFilterRules (ApplicationId, RuleOrder)
        WHERE IsActive = 1;
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'UQ_DenominatorFilterRules_ActiveRule'
      AND object_id = OBJECT_ID('app.DenominatorFilterRules')
)
BEGIN
    CREATE UNIQUE INDEX UQ_DenominatorFilterRules_ActiveRule
        ON app.DenominatorFilterRules (ApplicationId, DenominatorModelId, Operator, Value)
        WHERE IsActive = 1;
END;
