SET NOCOUNT ON;

IF OBJECT_ID('app.RuleChangeAudit', 'U') IS NOT NULL
BEGIN
    DROP TABLE app.RuleChangeAudit;
END;
