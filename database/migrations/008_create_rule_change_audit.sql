SET NOCOUNT ON;

:r ..\schema\app\RuleChangeAudit.sql

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_RuleChangeAudit_Application_ChangedAt'
      AND object_id = OBJECT_ID('app.RuleChangeAudit')
)
BEGIN
    CREATE INDEX IX_RuleChangeAudit_Application_ChangedAt
        ON app.RuleChangeAudit (ApplicationId, ChangedAt DESC)
        INCLUDE (ActorUserId);
END;
