IF OBJECT_ID('app.RuleChangeAudit', 'U') IS NULL
BEGIN
    CREATE TABLE app.RuleChangeAudit
    (
        AuditId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_RuleChangeAudit PRIMARY KEY,
        ApplicationId UNIQUEIDENTIFIER NOT NULL,
        ActorUserId NVARCHAR(255) NOT NULL,
        PreviousRulesJson NVARCHAR(MAX) NULL,
        NewRulesJson NVARCHAR(MAX) NOT NULL,
        ChangedAt DATETIME2 NOT NULL CONSTRAINT DF_RuleChangeAudit_ChangedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT FK_RuleChangeAudit_Applications FOREIGN KEY (ApplicationId) REFERENCES app.Applications(ApplicationId)
    );
END;
