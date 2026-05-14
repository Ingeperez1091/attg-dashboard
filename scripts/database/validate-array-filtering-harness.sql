SET NOCOUNT ON;
SET XACT_ABORT OFF;

DECLARE @ApplicationId UNIQUEIDENTIFIER = 'F0E00000-0000-0000-0000-000000000001';
DECLARE @RunId UNIQUEIDENTIFIER = NEWID();
DECLARE @ActorUserId NVARCHAR(128) = N'harness-user';
DECLARE @FailOnMismatch BIT = 1;

BEGIN TRY
    BEGIN TRAN;

    IF OBJECT_ID('app.usp_ExecutePipelineRun', 'P') IS NULL
    BEGIN
        THROW 52000, 'app.usp_ExecutePipelineRun not found. Run migrations first.', 1;
    END;

    IF OBJECT_ID('app.usp_BuildFilteredDenominator', 'P') IS NULL
    BEGIN
        THROW 52001, 'app.usp_BuildFilteredDenominator not found. Run migrations first.', 1;
    END;

    IF OBJECT_ID('app.usp_ApplyNumeratorFilters', 'P') IS NULL
    BEGIN
        THROW 52002, 'app.usp_ApplyNumeratorFilters not found. Run migrations first.', 1;
    END;

    -- 1) Seed isolated app/model/rules for deterministic validation.
    INSERT INTO app.Applications
    (
        ApplicationId,
        ApplicationName,
        AdoptionLevel,
        MatchKey,
        ServiceLine,
        SubServiceLine,
        [Description],
        IsActive,
        CreateDate,
        CreatedBy,
        UpdateDate,
        UpdatedBy
    )
    VALUES
    (
        @ApplicationId,
        N'HarnessApp',
        N'Client',
        N'client_id',
        N'Tax',
        N'Harness',
        N'Array payload validation harness app',
        1,
        SYSUTCDATETIME(),
        @ActorUserId,
        SYSUTCDATETIME(),
        @ActorUserId
    );

    INSERT INTO app.AdoptionSettings
    (
        SettingId,
        ApplicationId,
        AdoptionLevel,
        RevenueMetric,
        NumeratorSource,
        CreateDate,
        CreatedBy,
        UpdateDate,
        UpdatedBy
    )
    VALUES
    (
        NEWID(),
        @ApplicationId,
        N'Client',
        N'ETD_ANSRAmt',
        N'API',
        SYSUTCDATETIME(),
        @ActorUserId,
        SYSUTCDATETIME(),
        @ActorUserId
    );

    DECLARE @ClientIdFieldId UNIQUEIDENTIFIER = NEWID();
    DECLARE @RevenueFieldId UNIQUEIDENTIFIER = NEWID();
    DECLARE @ActiveFieldId UNIQUEIDENTIFIER = NEWID();

    INSERT INTO app.ApplicationModelFields
    (
        ApplicationModelFieldId,
        ApplicationId,
        FieldName,
        FieldType,
        SourcePath,
        IsActive,
        IsFilterable,
        IsMetricDimension,
        DisplayOrder,
        CreateDate,
        CreatedBy,
        UpdateDate,
        UpdatedBy
    )
    VALUES
        (@ClientIdFieldId, @ApplicationId, N'ClientId', N'text', N'$.clientId', 1, 1, 0, 1, SYSUTCDATETIME(), @ActorUserId, SYSUTCDATETIME(), @ActorUserId),
        (@RevenueFieldId,  @ApplicationId, N'TotalRevenueETD', N'numeric', N'$.totalRevenueETD', 1, 1, 0, 2, SYSUTCDATETIME(), @ActorUserId, SYSUTCDATETIME(), @ActorUserId),
        (@ActiveFieldId,   @ApplicationId, N'EYSTActive', N'text', N'$.eystActive', 1, 1, 0, 3, SYSUTCDATETIME(), @ActorUserId, SYSUTCDATETIME(), @ActorUserId);

    INSERT INTO app.NumeratorFilterRules
    (
        RuleId,
        ApplicationId,
        ApplicationModelFieldId,
        Operator,
        Value,
        RuleOrder,
        IsActive,
        CreateDate,
        CreatedBy,
        UpdateDate,
        UpdatedBy
    )
    VALUES
        (NEWID(), @ApplicationId, @RevenueFieldId, N'GREATER_OR_EQUAL', N'300000', 1, 1, SYSUTCDATETIME(), @ActorUserId, SYSUTCDATETIME(), @ActorUserId),
        (NEWID(), @ApplicationId, @ActiveFieldId,  N'EQUALS',           N'Yes',    2, 1, SYSUTCDATETIME(), @ActorUserId, SYSUTCDATETIME(), @ActorUserId);

    -- ClientID denominator model id from seed-denominator-models-and-adoption-settings.sql.
    INSERT INTO app.DenominatorFilterRules
    (
        RuleId,
        ApplicationId,
        DenominatorModelId,
        Operator,
        Value,
        RuleOrder,
        IsActive,
        CreateDate,
        CreatedBy,
        UpdateDate,
        UpdatedBy
    )
    VALUES
    (
        NEWID(),
        @ApplicationId,
        '50000000-0000-0000-0003-000000000000',
        N'IN_LIST',
        N'0014050741;0013399902',
        1,
        1,
        SYSUTCDATETIME(),
        @ActorUserId,
        SYSUTCDATETIME(),
        @ActorUserId
    );

    -- 2) Seed denominator snapshot rows used by #FilteredDenom.
    INSERT INTO stage.DenominatorSnapshot
    (
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
        LoadDate,
        CreateDate,
        CreatedBy,
        UpdateDate,
        UpdatedBy
    )
    VALUES
        (N'ENG-001', N'Eng 001', N'0014050741', N'Client 1', N'Tax', N'Harness', N'SVC', N'Service', N'Active', SYSUTCDATETIME(), SYSUTCDATETIME(), 111111.00, 111111.00, 10000.00, 10000.00, 100.00, 100.00, SYSUTCDATETIME(), SYSUTCDATETIME(), @ActorUserId, SYSUTCDATETIME(), @ActorUserId),
        (N'ENG-002', N'Eng 002', N'0013399902', N'Client 2', N'Tax', N'Harness', N'SVC', N'Service', N'Active', SYSUTCDATETIME(), SYSUTCDATETIME(), 222222.00, 222222.00, 20000.00, 20000.00, 200.00, 200.00, SYSUTCDATETIME(), SYSUTCDATETIME(), @ActorUserId, SYSUTCDATETIME(), @ActorUserId),
        (N'ENG-003', N'Eng 003', N'0099999999', N'Client 3', N'Tax', N'Harness', N'SVC', N'Service', N'Active', SYSUTCDATETIME(), SYSUTCDATETIME(), 333333.00, 333333.00, 30000.00, 30000.00, 300.00, 300.00, SYSUTCDATETIME(), SYSUTCDATETIME(), @ActorUserId, SYSUTCDATETIME(), @ActorUserId);

    -- 3) Seed one staged row with payload array.
    INSERT INTO stage.EngagementUsageRaw
    (
        StageId,
        ApplicationId,
        PayloadJson,
        CreateDate,
        CreatedBy
    )
    VALUES
    (
        '9A000000-0000-0000-0000-000000000001',
        @ApplicationId,
        N'{
            "payload": [
                {
                    "clientId": "0014050741",
                    "clientName": "Client 1",
                    "engagementCount": 1,
                    "totalRevenueETD": 256617.00,
                    "totalChargedHoursETD": 1240.00,
                    "eystActive": "Yes",
                    "eystDataCleanupActive": "Yes",
                    "notes": "below-revenue-threshold"
                },
                {
                    "clientId": "0013399902",
                    "clientName": "Client 2 first copy",
                    "engagementCount": 3,
                    "totalRevenueETD": 878949.00,
                    "totalChargedHoursETD": 1640.00,
                    "eystActive": "Yes",
                    "eystDataCleanupActive": "Yes",
                    "notes": "duplicate-first"
                },
                {
                    "clientId": "0013399902",
                    "clientName": "Client 2 second copy",
                    "engagementCount": 2,
                    "totalRevenueETD": 500000.00,
                    "totalChargedHoursETD": 1400.00,
                    "eystActive": "Yes",
                    "eystDataCleanupActive": "Yes",
                    "notes": "duplicate-second-kept"
                },
                {
                    "clientId": "0099999999",
                    "clientName": "Client 3 not in denominator",
                    "engagementCount": 1,
                    "totalRevenueETD": 400000.00,
                    "totalChargedHoursETD": 400.00,
                    "eystActive": "Yes",
                    "eystDataCleanupActive": "Yes",
                    "notes": "outside-denominator"
                },
                {
                    "clientName": "Missing key",
                    "engagementCount": 1,
                    "totalRevenueETD": 999999.00,
                    "totalChargedHoursETD": 999.00,
                    "eystActive": "Yes",
                    "eystDataCleanupActive": "Yes",
                    "notes": "missing-client-id"
                }
            ]
        }',
        SYSUTCDATETIME(),
        @ActorUserId
    );

    -- 4) Create run + execute full pipeline.
    INSERT INTO app.PipelineRuns
    (
        RunId,
        ApplicationId,
        Status,
        TriggerSource,
        CreateDate,
        CreatedBy,
        UpdateDate,
        UpdatedBy
    )
    VALUES
    (
        @RunId,
        @ApplicationId,
        N'Queued',
        N'Manual',
        SYSUTCDATETIME(),
        @ActorUserId,
        SYSUTCDATETIME(),
        @ActorUserId
    );

    EXEC app.usp_ExecutePipelineRun
        @runId = @RunId,
        @applicationId = @ApplicationId,
        @triggerSource = N'Manual',
        @actorUserId = @ActorUserId;

    -- 5) Report actual outputs used to validate subset correctness.
    SELECT
        vr.ResultId,
        vr.RecordKey,
        vr.Status,
        vr.ErrorMessage,
        vr.StageId,
        vr.CreateDate
    FROM app.ValidationResults vr
    WHERE vr.PipelineRunId = @RunId
      AND vr.ApplicationId = @ApplicationId
    ORDER BY
        CASE vr.Status
            WHEN 'Valid' THEN 1
            WHEN 'FilteredOut' THEN 2
            WHEN 'Duplicate' THEN 3
            WHEN 'Invalid' THEN 4
            ELSE 5
        END,
        vr.RecordKey;

    SELECT
        mr.NumeratorKey,
        mr.DenominatorKey,
        mr.RevenueAmount,
        mr.StageId,
        mr.CreateDate
    FROM app.MatchedRecords mr
    WHERE mr.PipelineRunId = @RunId
      AND mr.ApplicationId = @ApplicationId
    ORDER BY mr.NumeratorKey;

    DECLARE @Expected TABLE
    (
        MetricName NVARCHAR(64) NOT NULL,
        ExpectedValue INT NOT NULL
    );

    INSERT INTO @Expected (MetricName, ExpectedValue)
    VALUES
        (N'TotalRecordsIn', 5),
        (N'ValidCount', 1),
        (N'InvalidCount', 2),
        (N'DuplicateCount', 1),
        (N'FilteredOutCount', 1),
        (N'MatchedCount', 1);

    DECLARE @Actual TABLE
    (
        MetricName NVARCHAR(64) NOT NULL,
        ActualValue INT NOT NULL
    );

    INSERT INTO @Actual (MetricName, ActualValue)
    SELECT N'TotalRecordsIn', COUNT(*)
    FROM app.ValidationResults
    WHERE PipelineRunId = @RunId
      AND ApplicationId = @ApplicationId
    UNION ALL
    SELECT N'ValidCount', COUNT(*)
    FROM app.ValidationResults
    WHERE PipelineRunId = @RunId
      AND ApplicationId = @ApplicationId
      AND Status = N'Valid'
    UNION ALL
    SELECT N'InvalidCount', COUNT(*)
    FROM app.ValidationResults
    WHERE PipelineRunId = @RunId
      AND ApplicationId = @ApplicationId
      AND Status = N'Invalid'
    UNION ALL
    SELECT N'DuplicateCount', COUNT(*)
    FROM app.ValidationResults
    WHERE PipelineRunId = @RunId
      AND ApplicationId = @ApplicationId
      AND Status = N'Duplicate'
    UNION ALL
    SELECT N'FilteredOutCount', COUNT(*)
    FROM app.ValidationResults
    WHERE PipelineRunId = @RunId
      AND ApplicationId = @ApplicationId
      AND Status = N'FilteredOut'
    UNION ALL
    SELECT N'MatchedCount', COUNT(*)
    FROM app.MatchedRecords
    WHERE PipelineRunId = @RunId
      AND ApplicationId = @ApplicationId;

    SELECT
        e.MetricName,
        e.ExpectedValue,
        a.ActualValue,
        CASE WHEN e.ExpectedValue = a.ActualValue THEN N'PASS' ELSE N'FAIL' END AS CheckStatus
    FROM @Expected e
    INNER JOIN @Actual a ON a.MetricName = e.MetricName
    ORDER BY e.MetricName;

    IF @FailOnMismatch = 1
       AND EXISTS (
            SELECT 1
            FROM @Expected e
            INNER JOIN @Actual a ON a.MetricName = e.MetricName
            WHERE e.ExpectedValue <> a.ActualValue
       )
    BEGIN
        THROW 52003, 'Filtering harness failed: expected and actual metrics differ.', 1;
    END;

    -- Keep database clean after harness run.
    ROLLBACK TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRAN;

    THROW;
END CATCH;
