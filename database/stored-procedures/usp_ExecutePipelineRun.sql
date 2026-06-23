IF OBJECT_ID('app.usp_ExecutePipelineRun', 'P') IS NOT NULL
BEGIN
    DROP PROCEDURE app.usp_ExecutePipelineRun;
END;
GO

CREATE PROCEDURE app.usp_ExecutePipelineRun
    @runId UNIQUEIDENTIFIER,
    @applicationId UNIQUEIDENTIFIER,
    @triggerSource NVARCHAR(64),
    @actorUserId NVARCHAR(128),
    @previewSessionId UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- 1) Mark run as Processing
        UPDATE app.PipelineRuns
        SET Status = 'Processing',
            StartTime = SYSUTCDATETIME(),
            UpdateDate = SYSUTCDATETIME(),
            UpdatedBy = @actorUserId
        WHERE RunId = @runId;

        -- 2) Snapshot active rules used for this run
        MERGE app.FilterRuleSnapshots AS target
        USING (
            -- Denominator rules snapshot
            SELECT
                NEWID() AS SnapshotId,
                @runId AS PipelineRunId,
                'Denominator' AS RuleType,
                ISNULL((
                    SELECT
                        dfr.RuleId,
                        dfr.ApplicationId,
                        dfr.DenominatorModelId,
                        dm.FieldName,
                        dm.FieldType,
                        dfr.Operator,
                        dfr.Value,
                        dfr.RuleOrder
                    FROM app.DenominatorFilterRules dfr
                    INNER JOIN app.DenominatorModels dm ON dm.DenominatorModelId = dfr.DenominatorModelId
                    WHERE dfr.ApplicationId = @applicationId
                      AND dfr.IsActive = 1
                    FOR JSON PATH
                ), '[]') AS RulesJson
            UNION ALL
            -- Numerator rules snapshot
            SELECT
                NEWID() AS SnapshotId,
                @runId AS PipelineRunId,
                'Numerator' AS RuleType,
                ISNULL((
                    SELECT
                        nfr.RuleId,
                        nfr.ApplicationId,
                        nfr.ApplicationModelFieldId,
                        amf.FieldName,
                        amf.FieldType,
                        nfr.Operator,
                        nfr.Value,
                        nfr.RuleOrder
                    FROM app.NumeratorFilterRules nfr
                    INNER JOIN app.ApplicationModelFields amf ON amf.ApplicationModelFieldId = nfr.ApplicationModelFieldId
                    WHERE nfr.ApplicationId = @applicationId
                      AND nfr.IsActive = 1
                    FOR JSON PATH
                ), '[]') AS RulesJson
        ) AS source
        ON target.PipelineRunId = source.PipelineRunId AND target.RuleType = source.RuleType
        WHEN MATCHED THEN
            UPDATE SET
                target.RulesJson = source.RulesJson,
                target.UpdateDate = SYSUTCDATETIME(),
                target.UpdatedBy = @actorUserId
        WHEN NOT MATCHED THEN
            INSERT (SnapshotId, PipelineRunId, RuleType, RulesJson, CreateDate, CreatedBy, UpdateDate, UpdatedBy)
            VALUES (source.SnapshotId, source.PipelineRunId, source.RuleType, source.RulesJson, SYSUTCDATETIME(), @actorUserId, SYSUTCDATETIME(), @actorUserId);

        -- ============================================================
        -- 3) Build filtered denominator dataset for matching
        -- ============================================================
        IF OBJECT_ID('tempdb..#FilteredDenom') IS NOT NULL
            DROP TABLE #FilteredDenom;

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

        DECLARE @filteredDenominatorCount INT = 0;
        EXEC app.usp_BuildFilteredDenominator
            @runId = @runId,
            @applicationId = @applicationId,
            @filteredCount = @filteredDenominatorCount OUTPUT,
            @previewSessionId = @previewSessionId;

        -- Resolve application-specific matching settings with safe defaults.
        DECLARE @adoptionLevel NVARCHAR(32) = 'Engagement';
        DECLARE @metricSourcePath NVARCHAR(512);
        DECLARE @normalizedMetricSourcePath NVARCHAR(512);
        DECLARE @isClientAdoption BIT = 0;

        SELECT TOP (1)
            @adoptionLevel = AdoptionLevel
        FROM app.AdoptionSettings WHERE ApplicationId = @applicationId;

        SELECT TOP (1)
            @metricSourcePath = SourcePath
        FROM app.ApplicationModelFields
        WHERE ApplicationId = @applicationId
          AND IsActive = 1
          AND IsMetricDimension = 1
        ORDER BY DisplayOrder, ApplicationModelFieldId;

        SET @isClientAdoption = CASE WHEN LOWER(COALESCE(@adoptionLevel, '')) = 'client' THEN 1 ELSE 0 END;

        -- Normalize metric source path for JSON_VALUE extraction
        SET @normalizedMetricSourcePath = CASE
            WHEN @metricSourcePath IS NULL THEN NULL
            WHEN @metricSourcePath LIKE '$.payload.%' THEN '$.' + SUBSTRING(@metricSourcePath, 11, LEN(@metricSourcePath) - 10)
            ELSE @metricSourcePath
        END;

        -- ============================================================
        -- 4) Parse staged numerator records and derive key/duplicate rank
        -- ============================================================
        IF OBJECT_ID('tempdb..#ParsedNumerator') IS NOT NULL
            DROP TABLE #ParsedNumerator;

        ;WITH latest_stage AS (
            SELECT TOP (1) StageId
            FROM stage.EngagementUsageRaw
            WHERE ApplicationId = @applicationId
            ORDER BY CreateDate DESC
        ),
        parsed AS (
            SELECT
                NEWID() AS ResultId,
                eur.StageId,
                eur.PayloadJson,
                eur.CreatedBy,
                eur.CreateDate,
                item.ItemIndex,
                item.ItemJson,
                CASE
                    WHEN @isClientAdoption = 1 THEN JSON_VALUE(item.ItemJson, '$.clientId')
                    ELSE JSON_VALUE(item.ItemJson, '$.engagementId')
                END AS RecordKey,
                -- Composite key fields for dedup (always both)
                JSON_VALUE(item.ItemJson, '$.clientId') AS ClientId,
                JSON_VALUE(item.ItemJson, '$.engagementId') AS EngagementId,
                -- Dedup uses composite key
                ROW_NUMBER() OVER (
                    PARTITION BY
                        JSON_VALUE(item.ItemJson, '$.clientId'),
                        JSON_VALUE(item.ItemJson, '$.engagementId')
                    ORDER BY eur.StageId DESC, item.ItemIndex DESC
                ) AS DuplicateRank
            FROM stage.EngagementUsageRaw eur
            CROSS APPLY (
                SELECT
                    TRY_CONVERT(INT, j.[key]) AS ItemIndex,
                    j.value AS ItemJson
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
                WHERE (JSON_QUERY(eur.PayloadJson, '$.payload') IS NOT NULL
                     AND LEFT(LTRIM(JSON_QUERY(eur.PayloadJson, '$.payload')), 1) = '[')
                    OR LEFT(LTRIM(eur.PayloadJson), 1) = '['
            ) item
            INNER JOIN latest_stage ls ON eur.StageId = ls.StageId
        )
        SELECT
            ResultId,
            StageId,
            ItemIndex,
            ItemJson,
            RecordKey,
            ClientId,
            EngagementId,
            DuplicateRank
        INTO #ParsedNumerator
        FROM parsed;

        -- ============================================================
        -- 5) Persist base validation outcomes
        -- ============================================================
        DELETE FROM app.ValidationResults
        WHERE PipelineRunId = @runId
          AND ApplicationId = @applicationId;

        IF OBJECT_ID('tempdb..#ValidatedNumerator') IS NOT NULL
            DROP TABLE #ValidatedNumerator;

        CREATE TABLE #ValidatedNumerator
        (
            ResultId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
            StageId NVARCHAR(36) NOT NULL,
            RecordKey NVARCHAR(256) NULL,
            ItemIndex INT NULL,
            DuplicateRank INT NOT NULL,
            ItemJson NVARCHAR(MAX) NOT NULL
        );

        INSERT INTO app.ValidationResults
        (
            ResultId,
            PipelineRunId,
            StageId,
            ApplicationId,
            RecordKey,
            Status,
            ErrorMessage,
            CreateDate,
            CreatedBy,
            UpdateDate,
            UpdatedBy
        )
        SELECT
            pn.ResultId,
            @runId,
            CAST(pn.StageId AS NVARCHAR(36)),
            @applicationId,
            pn.RecordKey,
            CASE
                -- NULL composite key = Invalid (not duplicate)
                WHEN pn.ClientId IS NULL OR LTRIM(RTRIM(pn.ClientId)) = ''
                     OR pn.EngagementId IS NULL OR LTRIM(RTRIM(pn.EngagementId)) = ''
                    THEN 'Invalid'
                WHEN pn.RecordKey IS NULL OR LTRIM(RTRIM(pn.RecordKey)) = '' THEN 'Invalid'
                WHEN @isClientAdoption = 1 AND NOT EXISTS (
                    SELECT 1 FROM #FilteredDenom fd WHERE CAST(fd.ClientID AS NVARCHAR(256)) = pn.RecordKey
                ) THEN 'Invalid'
                WHEN @isClientAdoption = 0 AND NOT EXISTS (
                    SELECT 1 FROM #FilteredDenom fd WHERE CAST(fd.EngagementID AS NVARCHAR(256)) = pn.RecordKey
                ) THEN 'Invalid'
                ELSE 'Valid'
            END,
            CASE
                WHEN pn.ClientId IS NULL OR LTRIM(RTRIM(pn.ClientId)) = ''
                    THEN 'Missing key field: ClientId is NULL or empty'
                WHEN pn.EngagementId IS NULL OR LTRIM(RTRIM(pn.EngagementId)) = ''
                    THEN 'Missing key field: EngagementId is NULL or empty'
                WHEN pn.RecordKey IS NULL OR LTRIM(RTRIM(pn.RecordKey)) = '' THEN 'Missing Engagement/Client ID'
                WHEN @isClientAdoption = 1 AND NOT EXISTS (
                    SELECT 1 FROM #FilteredDenom fd WHERE CAST(fd.ClientID AS NVARCHAR(256)) = pn.RecordKey
                ) THEN CONCAT('Client ID ', pn.RecordKey, ' not found in denominator')
                WHEN @isClientAdoption = 0 AND NOT EXISTS (
                    SELECT 1 FROM #FilteredDenom fd WHERE CAST(fd.EngagementID AS NVARCHAR(256)) = pn.RecordKey
                ) THEN CONCAT('Engagement ID ', pn.RecordKey, ' not found in denominator')
                ELSE NULL
            END,
            SYSUTCDATETIME(),
            @actorUserId,
            SYSUTCDATETIME(),
            @actorUserId
        FROM #ParsedNumerator pn;

        INSERT INTO #ValidatedNumerator
        (
            ResultId,
            StageId,
            RecordKey,
            ItemIndex,
            DuplicateRank,
            ItemJson
        )
        SELECT
            pn.ResultId,
            CAST(pn.StageId AS NVARCHAR(36)),
            pn.RecordKey,
            pn.ItemIndex,
            pn.DuplicateRank,
            pn.ItemJson
        FROM #ParsedNumerator pn;

        -- ============================================================
        -- 6) Apply numerator filters to current Valid records
        -- ============================================================
        DECLARE @filteredOutCount INT = 0;
        EXEC app.usp_ApplyNumeratorFilters
            @runId = @runId,
            @applicationId = @applicationId,
            @filteredOutCount = @filteredOutCount OUTPUT;

        -- ============================================================
        -- 7) Build matched records between valid numerator and filtered denominator
        -- ============================================================
        DELETE FROM app.MatchedRecords
        WHERE PipelineRunId = @runId
          AND ApplicationId = @applicationId;

        INSERT INTO app.MatchedRecords
        (
            MatchedId,
            PipelineRunId,
            ApplicationId,
            NumeratorKey,
            DenominatorKey,
            RevenueAmount,
            StageId,
            CreateDate,
            CreatedBy,
            UpdateDate,
            UpdatedBy
        )
        SELECT
            NEWID(),
            @runId,
            @applicationId,
            vn.RecordKey,
            fd.DenominatorKey,
            TRY_CONVERT(DECIMAL(18,2), JSON_VALUE(vn.ItemJson, @normalizedMetricSourcePath)) AS RevenueAmount,
            vn.StageId,
            SYSUTCDATETIME(),
            @actorUserId,
            SYSUTCDATETIME(),
            @actorUserId
        FROM #ValidatedNumerator vn
        INNER JOIN app.ValidationResults vr
            ON vr.ResultId = vn.ResultId
        INNER JOIN (
            SELECT DISTINCT
                CASE
                    WHEN @isClientAdoption = 1 THEN CAST(fd.ClientID AS NVARCHAR(256))
                    ELSE CAST(fd.EngagementID AS NVARCHAR(256))
                END AS DenominatorKey
            FROM #FilteredDenom fd
            WHERE CASE
                    WHEN @isClientAdoption = 1 THEN CAST(fd.ClientID AS NVARCHAR(256))
                    ELSE CAST(fd.EngagementID AS NVARCHAR(256))
                END IS NOT NULL
              AND LTRIM(RTRIM(CASE
                    WHEN @isClientAdoption = 1 THEN CAST(fd.ClientID AS NVARCHAR(256))
                    ELSE CAST(fd.EngagementID AS NVARCHAR(256))
                END)) <> ''
        ) fd
            ON fd.DenominatorKey = vn.RecordKey
        WHERE vr.PipelineRunId = @runId
          AND vr.ApplicationId = @applicationId
          AND vr.Status = 'Valid';

        -- ============================================================
        -- 8) Aggregate metrics and finalize run
        -- ============================================================
        DECLARE @totalRecordsIn INT = 0;
        DECLARE @validCount INT = 0;
        DECLARE @invalidCount INT = 0;
        DECLARE @duplicateCount INT = 0;
        DECLARE @matchedCount INT = 0;
        DECLARE @snapshotDate DATETIME2 = NULL;

        SELECT @totalRecordsIn = COUNT(*)
        FROM #ParsedNumerator;

        SELECT @validCount = COUNT(*)
        FROM app.ValidationResults
        WHERE PipelineRunId = @runId
          AND ApplicationId = @applicationId
          AND Status = 'Valid';

        SELECT @invalidCount = COUNT(*)
        FROM app.ValidationResults
        WHERE PipelineRunId = @runId
          AND ApplicationId = @applicationId
          AND Status = 'Invalid';

        SELECT @duplicateCount = COUNT(*)
        FROM #ParsedNumerator
        WHERE DuplicateRank > 1;

        SELECT @matchedCount = COUNT(*)
        FROM app.MatchedRecords
        WHERE PipelineRunId = @runId
          AND ApplicationId = @applicationId;

        SELECT TOP (1) @snapshotDate = LoadDate
        FROM app.vw_DenominatorLocal;

        -- Mark duplicate records in ValidationResults
        UPDATE vr
        SET vr.Status = 'Duplicate',
            vr.ErrorMessage = CONCAT('Duplicate: ClientId=', pn.ClientId, ', EngagementId=', pn.EngagementId),
            vr.UpdateDate = SYSUTCDATETIME(),
            vr.UpdatedBy = @actorUserId
        FROM app.ValidationResults vr
        INNER JOIN #ParsedNumerator pn ON pn.ResultId = vr.ResultId
        WHERE vr.PipelineRunId = @runId
          AND vr.ApplicationId = @applicationId
          AND pn.DuplicateRank > 1
          AND vr.Status <> 'Invalid';

        -- Execute metrics calculation
        EXEC app.usp_CalculateMetrics
            @runId = @runId,
            @applicationId = @applicationId,
            @actorUserId = @actorUserId;

        -- Finalize run status and counts
        UPDATE app.PipelineRuns
        SET Status = 'Completed',
            EndTime = SYSUTCDATETIME(),
            TotalRecordsIn = @totalRecordsIn,
            ValidCount = @validCount,
            InvalidCount = @invalidCount,
            DuplicateCount = @duplicateCount,
            FilteredOutCount = @filteredOutCount,
            MatchedCount = @matchedCount,
            SnapshotDate = @snapshotDate,
            UpdateDate = SYSUTCDATETIME(),
            UpdatedBy = @actorUserId
        WHERE RunId = @runId;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        -- Mark run as failed with error details
        UPDATE app.PipelineRuns
        SET Status = 'Failed',
            EndTime = SYSUTCDATETIME(),
            ErrorMessage = ERROR_MESSAGE(),
            UpdateDate = SYSUTCDATETIME(),
            UpdatedBy = @actorUserId
        WHERE RunId = @runId;

        THROW;
    END CATCH;
END;
GO
