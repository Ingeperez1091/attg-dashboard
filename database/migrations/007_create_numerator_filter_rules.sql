SET NOCOUNT ON;

:r ..\schema\app\NumeratorFilterRules.sql

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_NumeratorFilterRules_Application_Active_Order'
      AND object_id = OBJECT_ID('app.NumeratorFilterRules')
)
BEGIN
    CREATE INDEX IX_NumeratorFilterRules_Application_Active_Order
        ON app.NumeratorFilterRules (ApplicationId, IsActive, RuleOrder)
        INCLUDE (ApplicationModelFieldId, Operator, Value, UpdateDate, UpdatedBy);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_NumeratorFilterRules_Field'
      AND object_id = OBJECT_ID('app.NumeratorFilterRules')
)
BEGIN
    CREATE INDEX IX_NumeratorFilterRules_Field
        ON app.NumeratorFilterRules (ApplicationModelFieldId, IsActive)
        INCLUDE (ApplicationId, RuleOrder, Operator);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'UQ_NumeratorFilterRules_ActiveOrder'
      AND object_id = OBJECT_ID('app.NumeratorFilterRules')
)
BEGIN
    CREATE UNIQUE INDEX UQ_NumeratorFilterRules_ActiveOrder
        ON app.NumeratorFilterRules (ApplicationId, RuleOrder)
        WHERE IsActive = 1;
END;
