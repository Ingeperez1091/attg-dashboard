IF OBJECT_ID('app.AdoptionSettings', 'U') IS NULL
BEGIN
    CREATE TABLE app.AdoptionSettings
    (
        SettingId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_AdoptionSettings PRIMARY KEY,
        ApplicationId UNIQUEIDENTIFIER NOT NULL,
        AdoptionLevel NVARCHAR(32) NOT NULL,
        RevenueMetric NVARCHAR(64) NOT NULL,
        NumeratorSource NVARCHAR(32) NOT NULL,
        CreateDate DATETIME2 NOT NULL CONSTRAINT DF_AdoptionSettings_CreateDate DEFAULT (SYSUTCDATETIME()),
        CreatedBy NVARCHAR(255) NOT NULL CONSTRAINT DF_AdoptionSettings_CreatedBy DEFAULT (SUSER_SNAME()),
        UpdateDate DATETIME2 NOT NULL CONSTRAINT DF_AdoptionSettings_UpdateDate DEFAULT (SYSUTCDATETIME()),
        UpdatedBy NVARCHAR(255) NOT NULL CONSTRAINT DF_AdoptionSettings_UpdatedBy DEFAULT (SUSER_SNAME()),
        CONSTRAINT FK_AdoptionSettings_Applications FOREIGN KEY (ApplicationId) REFERENCES app.Applications(ApplicationId),
        CONSTRAINT UQ_AdoptionSettings_ApplicationId UNIQUE (ApplicationId),
        CONSTRAINT CK_AdoptionSettings_AdoptionLevel CHECK (AdoptionLevel IN ('engagement', 'client')),
        CONSTRAINT CK_AdoptionSettings_NumeratorSource CHECK (NumeratorSource IN ('API', 'Manual'))
    );
END;
