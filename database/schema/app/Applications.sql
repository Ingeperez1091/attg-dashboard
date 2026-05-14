IF OBJECT_ID('app.Applications', 'U') IS NULL
BEGIN
    CREATE TABLE app.Applications
    (
        ApplicationId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Applications PRIMARY KEY,
        ApplicationName NVARCHAR(255) NOT NULL CONSTRAINT UQ_Applications_ApplicationName UNIQUE,
        AdoptionLevel NVARCHAR(50) NOT NULL,
        MatchKey NVARCHAR(100) NOT NULL,
        ServiceLine NVARCHAR(255) NOT NULL,
        SubServiceLine NVARCHAR(255) NOT NULL,
        Description NVARCHAR(1000) NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_Applications_IsActive DEFAULT (1),
        CreateDate DATETIME2 NOT NULL CONSTRAINT DF_Applications_CreateDate DEFAULT (SYSUTCDATETIME()),
        CreatedBy NVARCHAR(255) NOT NULL CONSTRAINT DF_Applications_CreatedBy DEFAULT (SUSER_SNAME()),
        UpdateDate DATETIME2 NOT NULL CONSTRAINT DF_Applications_UpdateDate DEFAULT (SYSUTCDATETIME()),
        UpdatedBy NVARCHAR(255) NOT NULL CONSTRAINT DF_Applications_UpdatedBy DEFAULT (SUSER_SNAME())
    );
END;
