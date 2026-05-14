SET NOCOUNT ON;

IF OBJECT_ID('app.usp_ExecutePipelineRun', 'P') IS NOT NULL
    DROP PROCEDURE app.usp_ExecutePipelineRun;

IF OBJECT_ID('app.usp_ApplyNumeratorFilters', 'P') IS NOT NULL
    DROP PROCEDURE app.usp_ApplyNumeratorFilters;

IF OBJECT_ID('app.usp_BuildFilteredDenominator', 'P') IS NOT NULL
    DROP PROCEDURE app.usp_BuildFilteredDenominator;

IF OBJECT_ID('app.vw_DenominatorLocal', 'V') IS NOT NULL
    DROP VIEW app.vw_DenominatorLocal;

IF OBJECT_ID('app.MetricSnapshots', 'U') IS NOT NULL
    DROP TABLE app.MetricSnapshots;

IF OBJECT_ID('stage.DenominatorSnapshot', 'U') IS NOT NULL
    DROP TABLE stage.DenominatorSnapshot;

IF OBJECT_ID('app.FilterRuleSnapshots', 'U') IS NOT NULL
    DROP TABLE app.FilterRuleSnapshots;

IF OBJECT_ID('app.MatchedRecords', 'U') IS NOT NULL
    DROP TABLE app.MatchedRecords;

IF OBJECT_ID('app.ValidationResults', 'U') IS NOT NULL
    DROP TABLE app.ValidationResults;

IF OBJECT_ID('app.PipelineRuns', 'U') IS NOT NULL
    DROP TABLE app.PipelineRuns;