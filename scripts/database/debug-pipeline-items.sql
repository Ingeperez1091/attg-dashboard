SET NOCOUNT ON;

:setvar ApplicationId ""

/*
Run with sqlcmd variables:
  -v RunId="<pipeline-run-guid>" ApplicationId="<optional-app-guid>"
*/

DECLARE @RunId UNIQUEIDENTIFIER = TRY_CONVERT(UNIQUEIDENTIFIER, '$(RunId)');
DECLARE @InputApplicationId UNIQUEIDENTIFIER = TRY_CONVERT(UNIQUEIDENTIFIER, NULLIF('$(ApplicationId)', ''));
DECLARE @ApplicationId UNIQUEIDENTIFIER;
DECLARE @AdoptionLevel NVARCHAR(32) = N'Engagement';
DECLARE @IsClientAdoption BIT = 0;

IF @RunId IS NULL
BEGIN
    THROW 53000, 'RunId is required (sqlcmd variable: RunId).', 1;
END;

SELECT @ApplicationId = pr.ApplicationId
FROM app.PipelineRuns pr
WHERE pr.RunId = @RunId;

IF @ApplicationId IS NULL
BEGIN
    THROW 53001, 'Pipeline run not found.', 1;
END;

IF @InputApplicationId IS NOT NULL AND @InputApplicationId <> @ApplicationId
BEGIN
    THROW 53002, 'ApplicationId does not match the application of the provided run.', 1;
END;

SELECT TOP (1)
    @AdoptionLevel = AdoptionLevel
FROM app.AdoptionSettings
WHERE ApplicationId = @ApplicationId;

SET @IsClientAdoption = CASE WHEN LOWER(COALESCE(@AdoptionLevel, '')) = 'client' THEN 1 ELSE 0 END;

IF OBJECT_ID('tempdb..#ParsedPayload') IS NOT NULL
    DROP TABLE #ParsedPayload;

IF OBJECT_ID('tempdb..#RunResults') IS NOT NULL
    DROP TABLE #RunResults;

IF OBJECT_ID('tempdb..#MatchedRows') IS NOT NULL
    DROP TABLE #MatchedRows;

;WITH payload_items AS (
    SELECT
        CAST(eur.StageId AS NVARCHAR(36)) AS StageId,
        TRY_CONVERT(INT, j.[key]) AS ItemIndex,
        j.value AS ItemJson,
        CASE
            WHEN @IsClientAdoption = 1 THEN JSON_VALUE(j.value, '$.clientId')
            ELSE JSON_VALUE(j.value, '$.engagementId')
        END AS RecordKey
    FROM stage.EngagementUsageRaw eur
    CROSS APPLY OPENJSON(
        CASE
            WHEN JSON_QUERY(eur.PayloadJson, '$.payload') IS NOT NULL
                 AND LEFT(LTRIM(JSON_QUERY(eur.PayloadJson, '$.payload')), 1) = '['
                THEN JSON_QUERY(eur.PayloadJson, '$.payload')
            WHEN LEFT(LTRIM(eur.PayloadJson), 1) = '['
                THEN eur.PayloadJson
            ELSE N'[]'
        END
    ) j
    WHERE eur.ApplicationId = @ApplicationId

    UNION ALL

    SELECT
        CAST(eur.StageId AS NVARCHAR(36)) AS StageId,
        NULL AS ItemIndex,
        eur.PayloadJson AS ItemJson,
        CASE
            WHEN @IsClientAdoption = 1 THEN JSON_VALUE(eur.PayloadJson, '$.clientId')
            ELSE JSON_VALUE(eur.PayloadJson, '$.engagementId')
        END AS RecordKey
    FROM stage.EngagementUsageRaw eur
    WHERE eur.ApplicationId = @ApplicationId
      AND NOT (
            (JSON_QUERY(eur.PayloadJson, '$.payload') IS NOT NULL
             AND LEFT(LTRIM(JSON_QUERY(eur.PayloadJson, '$.payload')), 1) = '[')
            OR LEFT(LTRIM(eur.PayloadJson), 1) = '['
      )
)
SELECT
    p.StageId,
    p.ItemIndex,
    p.RecordKey,
    p.ItemJson,
    ROW_NUMBER() OVER (
        PARTITION BY p.StageId, COALESCE(p.RecordKey, N'<NULL>')
        ORDER BY COALESCE(p.ItemIndex, -1), p.ItemJson
    ) AS RecordOccurrence
INTO #ParsedPayload
FROM payload_items p;

SELECT
    vr.ResultId,
    vr.PipelineRunId,
    vr.ApplicationId,
    vr.StageId,
    vr.RecordKey,
    vr.Status,
    vr.ErrorMessage,
    vr.CreateDate,
    ROW_NUMBER() OVER (
        PARTITION BY vr.StageId, COALESCE(vr.RecordKey, N'<NULL>')
        ORDER BY vr.CreateDate, vr.ResultId
    ) AS RecordOccurrence
INTO #RunResults
FROM app.ValidationResults vr
WHERE vr.PipelineRunId = @RunId
  AND vr.ApplicationId = @ApplicationId;

SELECT
    mr.StageId,
    mr.NumeratorKey,
    mr.DenominatorKey,
    mr.RevenueAmount
INTO #MatchedRows
FROM app.MatchedRecords mr
WHERE mr.PipelineRunId = @RunId
  AND mr.ApplicationId = @ApplicationId;

-- Detailed per-item debug view
SELECT
    rr.ResultId,
    rr.StageId,
    pp.ItemIndex,
    rr.RecordKey,
    rr.Status,
    CASE
        WHEN rr.Status = 'Valid' AND m.NumeratorKey IS NOT NULL THEN 'Matched'
        WHEN rr.Status = 'Valid' AND m.NumeratorKey IS NULL THEN 'ValidNotMatched'
        WHEN rr.Status = 'FilteredOut' THEN 'FilteredOut'
        WHEN rr.Status = 'Duplicate' THEN 'Duplicate'
        WHEN rr.Status = 'Invalid' THEN 'Invalid'
        ELSE 'Unknown'
    END AS DebugCategory,
    rr.ErrorMessage,
    m.DenominatorKey,
    m.RevenueAmount,
    pp.ItemJson
FROM #RunResults rr
LEFT JOIN #ParsedPayload pp
    ON pp.StageId = rr.StageId
   AND COALESCE(pp.RecordKey, N'<NULL>') = COALESCE(rr.RecordKey, N'<NULL>')
   AND pp.RecordOccurrence = rr.RecordOccurrence
LEFT JOIN #MatchedRows m
    ON m.StageId = rr.StageId
   AND m.NumeratorKey = rr.RecordKey
ORDER BY
    rr.StageId,
    COALESCE(pp.ItemIndex, -1),
    rr.RecordKey,
    rr.CreateDate;

-- Category summary
;WITH details AS (
    SELECT
        CASE
            WHEN rr.Status = 'Valid' AND m.NumeratorKey IS NOT NULL THEN 'Matched'
            WHEN rr.Status = 'Valid' AND m.NumeratorKey IS NULL THEN 'ValidNotMatched'
            WHEN rr.Status = 'FilteredOut' THEN 'FilteredOut'
            WHEN rr.Status = 'Duplicate' THEN 'Duplicate'
            WHEN rr.Status = 'Invalid' THEN 'Invalid'
            ELSE 'Unknown'
        END AS DebugCategory
    FROM #RunResults rr
    LEFT JOIN #MatchedRows m
        ON m.StageId = rr.StageId
       AND m.NumeratorKey = rr.RecordKey
)
SELECT
    DebugCategory,
    COUNT(*) AS ItemCount
FROM details
GROUP BY DebugCategory
ORDER BY DebugCategory;

-- Optional sanity check: payload items parsed but not represented in ValidationResults
SELECT
    pp.StageId,
    pp.ItemIndex,
    pp.RecordKey,
    pp.ItemJson
FROM #ParsedPayload pp
LEFT JOIN #RunResults rr
    ON rr.StageId = pp.StageId
   AND COALESCE(rr.RecordKey, N'<NULL>') = COALESCE(pp.RecordKey, N'<NULL>')
   AND rr.RecordOccurrence = pp.RecordOccurrence
WHERE rr.ResultId IS NULL
ORDER BY pp.StageId, COALESCE(pp.ItemIndex, -1), pp.RecordKey;
