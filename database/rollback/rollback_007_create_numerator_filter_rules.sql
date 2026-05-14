SET NOCOUNT ON;

IF OBJECT_ID('app.NumeratorFilterRules', 'U') IS NOT NULL
BEGIN
    DROP TABLE app.NumeratorFilterRules;
END;
