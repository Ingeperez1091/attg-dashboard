SET NOCOUNT ON;

IF OBJECT_ID('app.usp_ApplyNumeratorFilters', 'P') IS NOT NULL
BEGIN
    DROP PROCEDURE app.usp_ApplyNumeratorFilters;
END;
GO

CREATE PROCEDURE app.usp_ApplyNumeratorFilters
    @runId UNIQUEIDENTIFIER,
    @applicationId UNIQUEIDENTIFIER,
    @filteredOutCount INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    -- ============================================================
    -- 1) Initialize outputs and load active numerator rules
    -- ============================================================
    -- Initialize output for callers that consume filtered-out metrics.
    SET @filteredOutCount = 0;

    -- Load all active numerator rules into temp table (single query, no cursor overhead)
    IF OBJECT_ID('tempdb..#NumeratorRules') IS NOT NULL
        DROP TABLE #NumeratorRules;

    SELECT
        nfr.RuleId,
        amf.FieldName,
        amf.FieldType,
        amf.SourcePath,
        CASE
            WHEN amf.SourcePath LIKE '$.payload.%' THEN '$.' + SUBSTRING(amf.SourcePath, 11, LEN(amf.SourcePath) - 10)
            ELSE amf.SourcePath
        END AS NormalizedSourcePath,
        nfr.Operator,
        nfr.Value,
        nfr.RuleOrder
    INTO #NumeratorRules
    FROM app.NumeratorFilterRules nfr
    INNER JOIN app.ApplicationModelFields amf ON amf.ApplicationModelFieldId = nfr.ApplicationModelFieldId
    WHERE nfr.ApplicationId = @applicationId
      AND nfr.IsActive = 1
      AND amf.IsActive = 1;

    -- Validate all operators upfront (fail fast approach)
    IF EXISTS (
        SELECT 1 FROM #NumeratorRules
        WHERE Operator NOT IN (
            'EQUALS', 'NOT_EQUALS', 'CONTAINS', 'NOT_CONTAINS', 'IN_LIST', 'NOT_IN_LIST',
            'GREATER_THAN', 'GREATER_OR_EQUAL', 'LESS_THAN', 'LESS_OR_EQUAL'
        )
    )
    BEGIN
        THROW 51010, 'Unsupported numerator filter operator.', 1;
    END;

    -- ============================================================
    -- 2) Evaluate all active rules against current Valid records
    -- ============================================================
    -- Staging table to track rule failures per record (before aggregation)
    IF OBJECT_ID('tempdb..#NumeratorFailures') IS NOT NULL
        DROP TABLE #NumeratorFailures;

    CREATE TABLE #NumeratorFailures
    (
        ResultId UNIQUEIDENTIFIER NOT NULL,
        RuleOrder INT NOT NULL,
        FieldName NVARCHAR(128) NOT NULL,
        Operator NVARCHAR(20) NOT NULL,
        Value NVARCHAR(512) NOT NULL
    );

    -- SINGLE SET-BASED QUERY: Evaluate all rules against all valid records (O(1) table scan vs O(N))
    INSERT INTO #NumeratorFailures (ResultId, RuleOrder, FieldName, Operator, Value)
    SELECT DISTINCT
        vt.ResultId,
        nr.RuleOrder,
        nr.FieldName,
        nr.Operator,
        nr.Value
    FROM (
        SELECT
            vr.ResultId,
            vr.StageId,
            vr.RecordKey
        FROM app.ValidationResults vr
        WHERE vr.PipelineRunId = @runId
          AND vr.ApplicationId = @applicationId
          AND vr.Status = 'Valid'
    ) vt
    INNER JOIN (
        -- Restrict to the most recent staged row for this application
        SELECT TOP (1) StageId, PayloadJson
        FROM stage.EngagementUsageRaw
        WHERE ApplicationId = @applicationId
        ORDER BY CreateDate DESC
    ) eur
        ON CAST(eur.StageId AS NVARCHAR(36)) = vt.StageId
    CROSS APPLY (
        -- Expand arrays and keep single-object payload behavior for backward compatibility.
        SELECT
            j.value AS ItemJson,
            JSON_VALUE(j.value, '$.engagementId') AS ItemEngagementId,
            JSON_VALUE(j.value, '$.clientId') AS ItemClientId
        FROM OPENJSON(
            CASE
                WHEN JSON_QUERY(eur.PayloadJson, '$.payload') IS NOT NULL
                     AND LEFT(LTRIM(JSON_QUERY(eur.PayloadJson, '$.payload')), 1) = '['
                    THEN JSON_QUERY(eur.PayloadJson, '$.payload')
                WHEN LEFT(LTRIM(eur.PayloadJson), 1) = '['
                    THEN eur.PayloadJson
                ELSE N'[]'
            END
        ) j

        UNION ALL

        SELECT
            eur.PayloadJson AS ItemJson,
            JSON_VALUE(eur.PayloadJson, '$.engagementId') AS ItemEngagementId,
            JSON_VALUE(eur.PayloadJson, '$.clientId') AS ItemClientId
        WHERE NOT (
            (JSON_QUERY(eur.PayloadJson, '$.payload') IS NOT NULL
             AND LEFT(LTRIM(JSON_QUERY(eur.PayloadJson, '$.payload')), 1) = '[')
            OR LEFT(LTRIM(eur.PayloadJson), 1) = '['
        )
    ) payload
    -- Each valid numerator record is tested against every active rule.
    CROSS JOIN #NumeratorRules nr
    CROSS APPLY (
        SELECT
            JSON_VALUE(payload.ItemJson, nr.NormalizedSourcePath) AS RawValue,
            TRY_CONVERT(
                DECIMAL(38,10),
                JSON_VALUE(payload.ItemJson, nr.NormalizedSourcePath)
            ) AS NumericRawValue,
            TRY_CONVERT(DECIMAL(38,10), nr.Value) AS NumericRuleValue,
            COALESCE(
                TRY_CONVERT(DATETIME2(0), JSON_VALUE(payload.ItemJson, nr.NormalizedSourcePath), 126),
                TRY_CONVERT(DATETIME2(0), JSON_VALUE(payload.ItemJson, nr.NormalizedSourcePath), 23)
            ) AS DateRawValue,
            COALESCE(
                TRY_CONVERT(DATETIME2(0), nr.Value, 126),
                TRY_CONVERT(DATETIME2(0), nr.Value, 23)
            ) AS DateRuleValue,
            CASE
                WHEN LOWER(LTRIM(RTRIM(JSON_VALUE(payload.ItemJson, nr.NormalizedSourcePath)))) IN ('true', '1') THEN CONVERT(BIT, 1)
                WHEN LOWER(LTRIM(RTRIM(JSON_VALUE(payload.ItemJson, nr.NormalizedSourcePath)))) IN ('false', '0') THEN CONVERT(BIT, 0)
                ELSE NULL
            END AS BooleanRawValue,
            CASE
                WHEN LOWER(LTRIM(RTRIM(nr.Value))) IN ('true', '1') THEN CONVERT(BIT, 1)
                WHEN LOWER(LTRIM(RTRIM(nr.Value))) IN ('false', '0') THEN CONVERT(BIT, 0)
                ELSE NULL
            END AS BooleanRuleValue
    ) evaluated
    WHERE (
            ISNULL(payload.ItemEngagementId, '') = ISNULL(vt.RecordKey, '')
            OR ISNULL(payload.ItemClientId, '') = ISNULL(vt.RecordKey, '')
          )
      AND (
            -- Type-aware equality operators
            (nr.Operator = 'EQUALS' AND (
                (nr.FieldType = 'numeric' AND (
                    evaluated.NumericRawValue IS NULL
                    OR evaluated.NumericRuleValue IS NULL
                    OR evaluated.NumericRawValue <> evaluated.NumericRuleValue
                ))
                OR (nr.FieldType = 'date' AND (
                    evaluated.DateRawValue IS NULL
                    OR evaluated.DateRuleValue IS NULL
                    OR evaluated.DateRawValue <> evaluated.DateRuleValue
                ))
                OR (nr.FieldType = 'boolean' AND (
                    evaluated.BooleanRawValue IS NULL
                    OR evaluated.BooleanRuleValue IS NULL
                    OR evaluated.BooleanRawValue <> evaluated.BooleanRuleValue
                ))
                OR (nr.FieldType NOT IN ('numeric', 'date', 'boolean') AND ISNULL(evaluated.RawValue, '') <> nr.Value)
            ))
         OR (nr.Operator = 'NOT_EQUALS' AND (
                (nr.FieldType = 'numeric' AND (
                    evaluated.NumericRawValue IS NULL
                    OR evaluated.NumericRuleValue IS NULL
                    OR evaluated.NumericRawValue = evaluated.NumericRuleValue
                ))
                OR (nr.FieldType = 'date' AND (
                    evaluated.DateRawValue IS NULL
                    OR evaluated.DateRuleValue IS NULL
                    OR evaluated.DateRawValue = evaluated.DateRuleValue
                ))
                OR (nr.FieldType = 'boolean' AND (
                    evaluated.BooleanRawValue IS NULL
                    OR evaluated.BooleanRuleValue IS NULL
                    OR evaluated.BooleanRawValue = evaluated.BooleanRuleValue
                ))
                OR (nr.FieldType NOT IN ('numeric', 'date', 'boolean') AND ISNULL(evaluated.RawValue, '') = nr.Value)
            ))

            -- Text pattern operators
         OR (nr.Operator = 'CONTAINS' AND nr.FieldType = 'text' AND ISNULL(evaluated.RawValue, '') NOT LIKE '%' + nr.Value + '%')
         OR (nr.Operator = 'NOT_CONTAINS' AND nr.FieldType = 'text' AND ISNULL(evaluated.RawValue, '') LIKE '%' + nr.Value + '%')

            -- Set membership operators
         OR (nr.Operator = 'IN_LIST' AND nr.FieldType = 'text' AND NOT EXISTS (
                SELECT 1
                FROM STRING_SPLIT(nr.Value, ';') s
                WHERE LTRIM(RTRIM(s.value)) = ISNULL(evaluated.RawValue, '')
            ))
         OR (nr.Operator = 'NOT_IN_LIST' AND nr.FieldType = 'text' AND EXISTS (
                SELECT 1
                FROM STRING_SPLIT(nr.Value, ';') s
                WHERE LTRIM(RTRIM(s.value)) = ISNULL(evaluated.RawValue, '')
            ))

            -- Numeric/date comparison operators
         OR (nr.Operator = 'GREATER_THAN' AND nr.FieldType = 'numeric' AND (
                evaluated.NumericRawValue IS NULL
                OR evaluated.NumericRuleValue IS NULL
                OR evaluated.NumericRawValue <= evaluated.NumericRuleValue
            ))
         OR (nr.Operator = 'GREATER_THAN' AND nr.FieldType = 'date' AND (
                evaluated.DateRawValue IS NULL
                OR evaluated.DateRuleValue IS NULL
                OR evaluated.DateRawValue <= evaluated.DateRuleValue
            ))
         OR (nr.Operator = 'GREATER_OR_EQUAL' AND nr.FieldType = 'numeric' AND (
                evaluated.NumericRawValue IS NULL
                OR evaluated.NumericRuleValue IS NULL
                OR evaluated.NumericRawValue < evaluated.NumericRuleValue
            ))
         OR (nr.Operator = 'GREATER_OR_EQUAL' AND nr.FieldType = 'date' AND (
                evaluated.DateRawValue IS NULL
                OR evaluated.DateRuleValue IS NULL
                OR evaluated.DateRawValue < evaluated.DateRuleValue
            ))
         OR (nr.Operator = 'LESS_THAN' AND nr.FieldType = 'numeric' AND (
                evaluated.NumericRawValue IS NULL
                OR evaluated.NumericRuleValue IS NULL
                OR evaluated.NumericRawValue >= evaluated.NumericRuleValue
            ))
         OR (nr.Operator = 'LESS_THAN' AND nr.FieldType = 'date' AND (
                evaluated.DateRawValue IS NULL
                OR evaluated.DateRuleValue IS NULL
                OR evaluated.DateRawValue >= evaluated.DateRuleValue
            ))
         OR (nr.Operator = 'LESS_OR_EQUAL' AND nr.FieldType = 'numeric' AND (
                evaluated.NumericRawValue IS NULL
                OR evaluated.NumericRuleValue IS NULL
                OR evaluated.NumericRawValue > evaluated.NumericRuleValue
            ))
         OR (nr.Operator = 'LESS_OR_EQUAL' AND nr.FieldType = 'date' AND (
                evaluated.DateRawValue IS NULL
                OR evaluated.DateRuleValue IS NULL
                OR evaluated.DateRawValue > evaluated.DateRuleValue
            ))
      );

    -- ============================================================
    -- 3) Aggregate failures and update ValidationResults
    -- ============================================================
    IF OBJECT_ID('tempdb..#FailedNumeratorRules') IS NOT NULL
        DROP TABLE #FailedNumeratorRules;

    CREATE TABLE #FailedNumeratorRules
    (
        ResultId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        ErrorMessage NVARCHAR(MAX) NOT NULL
    );

    INSERT INTO #FailedNumeratorRules (ResultId, ErrorMessage)
    SELECT
        ResultId,
        'Failed filter rule(s): ' + STRING_AGG(FieldName + ' ' + Operator + ' ' + Value, '; ') WITHIN GROUP (ORDER BY RuleOrder)
    FROM #NumeratorFailures
    GROUP BY ResultId;

    UPDATE vr
    SET vr.Status = 'FilteredOut',
        vr.ErrorMessage = f.ErrorMessage,
        vr.UpdateDate = SYSUTCDATETIME(),
        vr.UpdatedBy = 'usp_ApplyNumeratorFilters'
    FROM app.ValidationResults vr
    INNER JOIN #FailedNumeratorRules f ON f.ResultId = vr.ResultId
    WHERE vr.PipelineRunId = @runId
      AND vr.ApplicationId = @applicationId
      AND vr.Status = 'Valid';

    SELECT @filteredOutCount = COUNT(*) FROM #FailedNumeratorRules;

    -- ============================================================
    -- 4) Cleanup temp resources
    -- ============================================================
    DROP TABLE #FailedNumeratorRules;
    DROP TABLE #NumeratorFailures;
    DROP TABLE #NumeratorRules;
END;
GO
