SET NOCOUNT ON;

IF OBJECT_ID('app.usp_BuildFilteredDenominator', 'P') IS NOT NULL
BEGIN
    DROP PROCEDURE app.usp_BuildFilteredDenominator;
END;
GO

CREATE PROCEDURE app.usp_BuildFilteredDenominator
    @runId UNIQUEIDENTIFIER,
    @applicationId UNIQUEIDENTIFIER,
    @filteredCount INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    -- ============================================================
    -- 1) Validate denominator source prerequisites
    -- ============================================================
    -- Guard clause: denominator projection view must exist before filtering can run.
    IF OBJECT_ID('app.vw_DenominatorLocal', 'V') IS NULL
    BEGIN
        THROW 51000, 'app.vw_DenominatorLocal does not exist.', 1;
    END;

    -- Guard clause: empty denominator input is treated as a hard failure.
    IF NOT EXISTS (SELECT 1 FROM app.vw_DenominatorLocal)
    BEGIN
        THROW 51001, 'app.vw_DenominatorLocal is empty.', 1;
    END;

    -- ============================================================
    -- 2) Prepare temp tables for filtered data and active rules
    -- ============================================================
    -- Initialize filtered denominator table
    IF OBJECT_ID('tempdb..#FilteredDenom') IS NULL
    BEGIN
        SELECT TOP (0)
            CAST(SnapshotId AS INT) AS SnapshotId,
            EngagementID,
            Engagement,
            ClientID,
            Client,
            AccountChannel,
            EngagementSubServiceLine,
            EngagementServiceCode,
            EngagementService,
            EngagementStatus,
            CreationDate,
            ReleaseDate,
            ETD_ANSRAmt,
            FYTD_ANSRAmt,
            ETD_TERAmt,
            FYTD_TERAmt,
            ETD_ChargedHours,
            FYTD_ChargedHours,
            LoadDate
        INTO #FilteredDenom
        FROM app.vw_DenominatorLocal;
    END
    ELSE
    BEGIN
        DELETE FROM #FilteredDenom;
    END;

    -- Load all active denominator rules into temp table
    IF OBJECT_ID('tempdb..#DenominatorRules') IS NOT NULL
        DROP TABLE #DenominatorRules;

    SELECT
        ROW_NUMBER() OVER (ORDER BY dfr.RuleOrder) AS RuleId,
        dm.SourceColumn,
        dm.FieldType,
        dfr.Operator,
        dfr.Value,
        dfr.RuleOrder
    INTO #DenominatorRules
    FROM app.DenominatorFilterRules dfr
    INNER JOIN app.DenominatorModels dm ON dm.DenominatorModelId = dfr.DenominatorModelId
    WHERE dfr.ApplicationId = @applicationId
      AND dfr.IsActive = 1
      AND dm.IsActive = 1;

    -- Validate all operators upfront (fail fast)
    IF EXISTS (
        SELECT 1 FROM #DenominatorRules
        WHERE Operator NOT IN (
            'EQUALS', 'NOT_EQUALS', 'CONTAINS', 'NOT_CONTAINS', 'IN_LIST', 'NOT_IN_LIST',
            'GREATER_THAN', 'GREATER_OR_EQUAL', 'LESS_THAN', 'LESS_OR_EQUAL'
        )
    )
    BEGIN
        THROW 51002, 'Unsupported denominator filter operator.', 1;
    END;

    -- ============================================================
    -- 3) Apply denominator rules in rule order
    -- ============================================================
    -- Build one WHERE clause from all rules and execute a single filtered insert.
    -- This avoids cursor row-by-row deletes and scans denominator data only once.
    DECLARE @whereClause NVARCHAR(MAX) = NULL;
    DECLARE @sql NVARCHAR(MAX);

    SELECT @whereClause = STRING_AGG(
        CASE Operator
            WHEN 'EQUALS'
                THEN CASE
                    WHEN FieldType = 'numeric'
                        THEN N'TRY_CONVERT(DECIMAL(38, 10), d.' + QUOTENAME(REPLACE(REPLACE(SourceColumn, '[', ''), ']', '')) + N') = TRY_CONVERT(DECIMAL(38, 10), N''' + REPLACE(Value, '''', '''''') + N''')'
                    WHEN FieldType = 'date'
                        THEN N'COALESCE(TRY_CONVERT(DATETIME2(0), d.' + QUOTENAME(REPLACE(REPLACE(SourceColumn, '[', ''), ']', '')) + N', 126), TRY_CONVERT(DATETIME2(0), d.' + QUOTENAME(REPLACE(REPLACE(SourceColumn, '[', ''), ']', '')) + N', 23)) = COALESCE(TRY_CONVERT(DATETIME2(0), N''' + REPLACE(Value, '''', '''''') + N''', 126), TRY_CONVERT(DATETIME2(0), N''' + REPLACE(Value, '''', '''''') + N''', 23))'
                    WHEN FieldType = 'boolean'
                        THEN N'CASE WHEN LOWER(LTRIM(RTRIM(CAST(d.' + QUOTENAME(REPLACE(REPLACE(SourceColumn, '[', ''), ']', '')) + N' AS NVARCHAR(20))))) IN (''true'', ''1'') THEN CONVERT(BIT, 1) WHEN LOWER(LTRIM(RTRIM(CAST(d.' + QUOTENAME(REPLACE(REPLACE(SourceColumn, '[', ''), ']', '')) + N' AS NVARCHAR(20))))) IN (''false'', ''0'') THEN CONVERT(BIT, 0) ELSE NULL END = CASE WHEN LOWER(LTRIM(RTRIM(N''' + REPLACE(Value, '''', '''''') + N'''))) IN (''true'', ''1'') THEN CONVERT(BIT, 1) WHEN LOWER(LTRIM(RTRIM(N''' + REPLACE(Value, '''', '''''') + N'''))) IN (''false'', ''0'') THEN CONVERT(BIT, 0) ELSE NULL END'
                    ELSE N'CAST(d.' + QUOTENAME(REPLACE(REPLACE(SourceColumn, '[', ''), ']', '')) + N' AS NVARCHAR(4000)) = N''' + REPLACE(Value, '''', '''''') + N''''
                END
            WHEN 'NOT_EQUALS'
                THEN CASE
                    WHEN FieldType = 'numeric'
                        THEN N'TRY_CONVERT(DECIMAL(38, 10), d.' + QUOTENAME(REPLACE(REPLACE(SourceColumn, '[', ''), ']', '')) + N') <> TRY_CONVERT(DECIMAL(38, 10), N''' + REPLACE(Value, '''', '''''') + N''')'
                    WHEN FieldType = 'date'
                        THEN N'COALESCE(TRY_CONVERT(DATETIME2(0), d.' + QUOTENAME(REPLACE(REPLACE(SourceColumn, '[', ''), ']', '')) + N', 126), TRY_CONVERT(DATETIME2(0), d.' + QUOTENAME(REPLACE(REPLACE(SourceColumn, '[', ''), ']', '')) + N', 23)) <> COALESCE(TRY_CONVERT(DATETIME2(0), N''' + REPLACE(Value, '''', '''''') + N''', 126), TRY_CONVERT(DATETIME2(0), N''' + REPLACE(Value, '''', '''''') + N''', 23))'
                    WHEN FieldType = 'boolean'
                        THEN N'CASE WHEN LOWER(LTRIM(RTRIM(CAST(d.' + QUOTENAME(REPLACE(REPLACE(SourceColumn, '[', ''), ']', '')) + N' AS NVARCHAR(20))))) IN (''true'', ''1'') THEN CONVERT(BIT, 1) WHEN LOWER(LTRIM(RTRIM(CAST(d.' + QUOTENAME(REPLACE(REPLACE(SourceColumn, '[', ''), ']', '')) + N' AS NVARCHAR(20))))) IN (''false'', ''0'') THEN CONVERT(BIT, 0) ELSE NULL END <> CASE WHEN LOWER(LTRIM(RTRIM(N''' + REPLACE(Value, '''', '''''') + N'''))) IN (''true'', ''1'') THEN CONVERT(BIT, 1) WHEN LOWER(LTRIM(RTRIM(N''' + REPLACE(Value, '''', '''''') + N'''))) IN (''false'', ''0'') THEN CONVERT(BIT, 0) ELSE NULL END'
                    ELSE N'CAST(d.' + QUOTENAME(REPLACE(REPLACE(SourceColumn, '[', ''), ']', '')) + N' AS NVARCHAR(4000)) <> N''' + REPLACE(Value, '''', '''''') + N''''
                END
            WHEN 'CONTAINS'
                THEN N'CAST(d.' + QUOTENAME(REPLACE(REPLACE(SourceColumn, '[', ''), ']', '')) + N' AS NVARCHAR(4000)) LIKE N''%' + REPLACE(Value, '''', '''''') + N'%'''
            WHEN 'NOT_CONTAINS'
                THEN N'CAST(d.' + QUOTENAME(REPLACE(REPLACE(SourceColumn, '[', ''), ']', '')) + N' AS NVARCHAR(4000)) NOT LIKE N''%' + REPLACE(Value, '''', '''''') + N'%'''
            WHEN 'IN_LIST'
                THEN N'EXISTS (SELECT 1 FROM STRING_SPLIT(N''' + REPLACE(Value, '''', '''''') + N''', '';'') s WHERE LTRIM(RTRIM(s.value)) = CAST(d.' + QUOTENAME(REPLACE(REPLACE(SourceColumn, '[', ''), ']', '')) + N' AS NVARCHAR(4000)))'
            WHEN 'NOT_IN_LIST'
                THEN N'NOT EXISTS (SELECT 1 FROM STRING_SPLIT(N''' + REPLACE(Value, '''', '''''') + N''', '';'') s WHERE LTRIM(RTRIM(s.value)) = CAST(d.' + QUOTENAME(REPLACE(REPLACE(SourceColumn, '[', ''), ']', '')) + N' AS NVARCHAR(4000)))'
            WHEN 'GREATER_THAN'
                THEN CASE
                    WHEN FieldType = 'date'
                        THEN N'COALESCE(TRY_CONVERT(DATETIME2(0), d.' + QUOTENAME(REPLACE(REPLACE(SourceColumn, '[', ''), ']', '')) + N', 126), TRY_CONVERT(DATETIME2(0), d.' + QUOTENAME(REPLACE(REPLACE(SourceColumn, '[', ''), ']', '')) + N', 23)) > COALESCE(TRY_CONVERT(DATETIME2(0), N''' + REPLACE(Value, '''', '''''') + N''', 126), TRY_CONVERT(DATETIME2(0), N''' + REPLACE(Value, '''', '''''') + N''', 23))'
                    ELSE N'TRY_CONVERT(DECIMAL(38, 10), d.' + QUOTENAME(REPLACE(REPLACE(SourceColumn, '[', ''), ']', '')) + N') > TRY_CONVERT(DECIMAL(38, 10), N''' + REPLACE(Value, '''', '''''') + N''')'
                END
            WHEN 'GREATER_OR_EQUAL'
                THEN CASE
                    WHEN FieldType = 'date'
                        THEN N'COALESCE(TRY_CONVERT(DATETIME2(0), d.' + QUOTENAME(REPLACE(REPLACE(SourceColumn, '[', ''), ']', '')) + N', 126), TRY_CONVERT(DATETIME2(0), d.' + QUOTENAME(REPLACE(REPLACE(SourceColumn, '[', ''), ']', '')) + N', 23)) >= COALESCE(TRY_CONVERT(DATETIME2(0), N''' + REPLACE(Value, '''', '''''') + N''', 126), TRY_CONVERT(DATETIME2(0), N''' + REPLACE(Value, '''', '''''') + N''', 23))'
                    ELSE N'TRY_CONVERT(DECIMAL(38, 10), d.' + QUOTENAME(REPLACE(REPLACE(SourceColumn, '[', ''), ']', '')) + N') >= TRY_CONVERT(DECIMAL(38, 10), N''' + REPLACE(Value, '''', '''''') + N''')'
                END
            WHEN 'LESS_THAN'
                THEN CASE
                    WHEN FieldType = 'date'
                        THEN N'COALESCE(TRY_CONVERT(DATETIME2(0), d.' + QUOTENAME(REPLACE(REPLACE(SourceColumn, '[', ''), ']', '')) + N', 126), TRY_CONVERT(DATETIME2(0), d.' + QUOTENAME(REPLACE(REPLACE(SourceColumn, '[', ''), ']', '')) + N', 23)) < COALESCE(TRY_CONVERT(DATETIME2(0), N''' + REPLACE(Value, '''', '''''') + N''', 126), TRY_CONVERT(DATETIME2(0), N''' + REPLACE(Value, '''', '''''') + N''', 23))'
                    ELSE N'TRY_CONVERT(DECIMAL(38, 10), d.' + QUOTENAME(REPLACE(REPLACE(SourceColumn, '[', ''), ']', '')) + N') < TRY_CONVERT(DECIMAL(38, 10), N''' + REPLACE(Value, '''', '''''') + N''')'
                END
            WHEN 'LESS_OR_EQUAL'
                THEN CASE
                    WHEN FieldType = 'date'
                        THEN N'COALESCE(TRY_CONVERT(DATETIME2(0), d.' + QUOTENAME(REPLACE(REPLACE(SourceColumn, '[', ''), ']', '')) + N', 126), TRY_CONVERT(DATETIME2(0), d.' + QUOTENAME(REPLACE(REPLACE(SourceColumn, '[', ''), ']', '')) + N', 23)) <= COALESCE(TRY_CONVERT(DATETIME2(0), N''' + REPLACE(Value, '''', '''''') + N''', 126), TRY_CONVERT(DATETIME2(0), N''' + REPLACE(Value, '''', '''''') + N''', 23))'
                    ELSE N'TRY_CONVERT(DECIMAL(38, 10), d.' + QUOTENAME(REPLACE(REPLACE(SourceColumn, '[', ''), ']', '')) + N') <= TRY_CONVERT(DECIMAL(38, 10), N''' + REPLACE(Value, '''', '''''') + N''')'
                END
            ELSE N'1 = 0'
        END,
        N' AND '
    ) WITHIN GROUP (ORDER BY RuleOrder)
    FROM #DenominatorRules;

    -- No active rules means the full denominator is addressable.
    IF @whereClause IS NULL OR @whereClause = N''
    BEGIN
        SET @whereClause = N'1 = 1';
    END;

    SET @sql = N'
        INSERT INTO #FilteredDenom
        SELECT d.*
        FROM app.vw_DenominatorLocal d
        WHERE ' + @whereClause + N';';

    EXEC sp_executesql @sql;

    -- ============================================================
    -- 4) Cleanup and return output
    -- ============================================================
    -- Cleanup rule metadata table for this execution scope.
    DROP TABLE #DenominatorRules;

    -- Return final denominator row count after all rule predicates are applied.
    SELECT @filteredCount = COUNT(*) FROM #FilteredDenom;
END;
GO
