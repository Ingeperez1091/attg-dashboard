IF OBJECT_ID('stage.DenominatorSnapshot', 'U') IS NULL
BEGIN
    CREATE TABLE stage.DenominatorSnapshot (
        SnapshotId INT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
        EngagementID NVARCHAR(64) NULL,
        Engagement NVARCHAR(512) NULL,
        ClientID NVARCHAR(64) NULL,
        Client NVARCHAR(512) NULL,
        AccountChannel NVARCHAR(32) NULL,
        EngagementSubServiceLine NVARCHAR(128) NULL,
        EngagementServiceCode NVARCHAR(32) NULL,
        EngagementService NVARCHAR(256) NULL,
        EngagementStatus NVARCHAR(64) NULL,
        CreationDate DATETIME2 NULL,
        ReleaseDate DATETIME2 NULL,
        ETD_ANSRAmt DECIMAL(18, 2) NULL,
        FYTD_ANSRAmt DECIMAL(18, 2) NULL,
        ETD_TERAmt DECIMAL(18, 2) NULL,
        FYTD_TERAmt DECIMAL(18, 2) NULL,
        ETD_ChargedHours DECIMAL(18, 2) NULL,
        FYTD_ChargedHours DECIMAL(18, 2) NULL,
        LoadDate DATETIME2 NOT NULL CONSTRAINT DF_DenominatorSnapshot_LoadDate DEFAULT (SYSUTCDATETIME()),
        CreateDate DATETIME2 NOT NULL CONSTRAINT DF_DenominatorSnapshot_CreateDate DEFAULT (SYSUTCDATETIME()),
        CreatedBy NVARCHAR(128) NOT NULL CONSTRAINT DF_DenominatorSnapshot_CreatedBy DEFAULT ('PL_DenomLoad_Weekly'),
        UpdateDate DATETIME2 NOT NULL CONSTRAINT DF_DenominatorSnapshot_UpdateDate DEFAULT (SYSUTCDATETIME()),
        UpdatedBy NVARCHAR(128) NOT NULL CONSTRAINT DF_DenominatorSnapshot_UpdatedBy DEFAULT ('PL_DenomLoad_Weekly')
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'IX_DenominatorSnapshot_EngagementID' AND object_id = OBJECT_ID('stage.DenominatorSnapshot')
)
BEGIN
    CREATE INDEX IX_DenominatorSnapshot_EngagementID ON stage.DenominatorSnapshot (EngagementID);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'IX_DenominatorSnapshot_ClientID' AND object_id = OBJECT_ID('stage.DenominatorSnapshot')
)
BEGIN
    CREATE INDEX IX_DenominatorSnapshot_ClientID ON stage.DenominatorSnapshot (ClientID);
END;
