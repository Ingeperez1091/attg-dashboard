IF OBJECT_ID('stage.EngagementUsageRaw', 'U') IS NULL
BEGIN
    CREATE TABLE stage.EngagementUsageRaw
    (
        StageId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_EngagementUsageRaw PRIMARY KEY,
        ApplicationId UNIQUEIDENTIFIER NOT NULL,
        PayloadJson NVARCHAR(MAX) NOT NULL,
        CreateDate DATETIME2 NOT NULL CONSTRAINT DF_EngagementUsageRaw_CreateDate DEFAULT (SYSUTCDATETIME()),
        CreatedBy NVARCHAR(255) NOT NULL CONSTRAINT DF_EngagementUsageRaw_CreatedBy DEFAULT (SUSER_SNAME()),
        CONSTRAINT FK_EngagementUsageRaw_Applications FOREIGN KEY (ApplicationId) REFERENCES app.Applications(ApplicationId)
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('stage.EngagementUsageRaw') AND name = 'IX_EngagementUsageRaw_ApplicationId')
BEGIN
    CREATE INDEX IX_EngagementUsageRaw_ApplicationId ON stage.EngagementUsageRaw(ApplicationId);
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('stage.EngagementUsageRaw') AND name = 'IX_EngagementUsageRaw_CreateDate')
BEGIN
    CREATE INDEX IX_EngagementUsageRaw_CreateDate ON stage.EngagementUsageRaw(CreateDate);
END;
