IF OBJECT_ID('app.ConfigVersions', 'U') IS NULL
BEGIN
    CREATE TABLE app.ConfigVersions (
        ApplicationId UNIQUEIDENTIFIER NOT NULL,
        RuleScope NVARCHAR(32) NOT NULL,
        Version INT NOT NULL
            CONSTRAINT DF_ConfigVersions_Version DEFAULT (1),
        LastModifiedBy NVARCHAR(255) NOT NULL,
        LastModifiedAt DATETIME2 NOT NULL
            CONSTRAINT DF_ConfigVersions_LastModifiedAt DEFAULT (SYSUTCDATETIME()),

        CONSTRAINT PK_ConfigVersions PRIMARY KEY CLUSTERED (ApplicationId, RuleScope),
        CONSTRAINT FK_ConfigVersions_Applications
            FOREIGN KEY (ApplicationId) REFERENCES app.Applications (ApplicationId),
        CONSTRAINT CK_ConfigVersions_RuleScope
            CHECK (RuleScope IN ('Denominator', 'Numerator'))
    );
END;
