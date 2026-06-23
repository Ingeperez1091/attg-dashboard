SET NOCOUNT ON;

-- Rollback 033: Drop app.ConfigEditSessions
IF OBJECT_ID('app.ConfigEditSessions', 'U') IS NOT NULL
    DROP TABLE app.ConfigEditSessions;
