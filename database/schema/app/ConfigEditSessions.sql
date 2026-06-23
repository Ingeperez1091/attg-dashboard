IF OBJECT_ID('app.ConfigEditSessions', 'U') IS NULL
BEGIN
    CREATE TABLE app.ConfigEditSessions (
        SessionId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT PK_ConfigEditSessions PRIMARY KEY CLUSTERED
            CONSTRAINT DF_ConfigEditSessions_SessionId DEFAULT (NEWID()),
        ApplicationId UNIQUEIDENTIFIER NOT NULL,
        RuleScope NVARCHAR(32) NOT NULL,
        UserId NVARCHAR(255) NOT NULL,
        DisplayName NVARCHAR(256) NULL,
        SessionStart DATETIME2 NOT NULL
            CONSTRAINT DF_ConfigEditSessions_SessionStart DEFAULT (SYSUTCDATETIME()),
        LastHeartbeat DATETIME2 NOT NULL
            CONSTRAINT DF_ConfigEditSessions_LastHeartbeat DEFAULT (SYSUTCDATETIME()),
        IsActive BIT NOT NULL
            CONSTRAINT DF_ConfigEditSessions_IsActive DEFAULT (1),

        CONSTRAINT FK_ConfigEditSessions_Applications
            FOREIGN KEY (ApplicationId) REFERENCES app.Applications (ApplicationId),
        CONSTRAINT CK_ConfigEditSessions_RuleScope
            CHECK (RuleScope IN ('Denominator', 'Numerator'))
    );
END;
