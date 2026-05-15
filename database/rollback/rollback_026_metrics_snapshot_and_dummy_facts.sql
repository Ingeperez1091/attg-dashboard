SET NOCOUNT ON;

IF OBJECT_ID('app.usp_CalculateMetrics', 'P') IS NOT NULL
BEGIN
    DROP PROCEDURE app.usp_CalculateMetrics;
END;

IF OBJECT_ID('app.InvestmentDummyFacts', 'U') IS NOT NULL
BEGIN
    DROP TABLE app.InvestmentDummyFacts;
END;

IF OBJECT_ID('app.MetricSnapshots', 'U') IS NOT NULL
BEGIN
    DROP TABLE app.MetricSnapshots;
END;

:r ..\schema\app\MetricsSnapshotsBase.sql