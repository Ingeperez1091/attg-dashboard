SET NOCOUNT ON;

IF OBJECT_ID('app.DenominatorFilterRules', 'U') IS NOT NULL
BEGIN
    DROP TABLE app.DenominatorFilterRules;
END;
