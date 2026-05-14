SET NOCOUNT ON;

DECLARE @ApplicationId UNIQUEIDENTIFIER;
SELECT TOP (1) @ApplicationId = ApplicationId FROM app.Applications;

IF @ApplicationId IS NULL
    THROW 51000, 'No app.Applications rows found for staging integration test', 1;

BEGIN TRAN;

DECLARE @StageId UNIQUEIDENTIFIER = NEWID();
DECLARE @Payload NVARCHAR(MAX) = N'{"engagementId":"E-1001","status":"GREEN","notes":"UTF-8 test: cafe"}';

INSERT INTO stage.EngagementUsageRaw(StageId, ApplicationId, PayloadJson, CreateDate, CreatedBy)
VALUES (@StageId, @ApplicationId, @Payload, SYSUTCDATETIME(), SUSER_SNAME());

IF NOT EXISTS (SELECT 1 FROM stage.EngagementUsageRaw WHERE StageId = @StageId AND PayloadJson = @Payload)
    THROW 51000, 'Raw payload was not preserved exactly', 1;

SELECT 'US2 integration checks passed' AS Result;

ROLLBACK TRAN;
