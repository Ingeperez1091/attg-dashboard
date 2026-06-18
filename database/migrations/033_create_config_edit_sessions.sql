SET NOCOUNT ON;

-- ============================================================
-- Migration 033: Create app.ConfigEditSessions
-- Purpose: Tracks active editing sessions for advisory presence
--          warnings. Sessions auto-expire after 5 minutes
--          without heartbeat.
-- ============================================================

:r ..\schema\app\ConfigEditSessions.sql

-- Index for querying active editors by application + scope
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_ConfigEditSessions_App_Scope_Active'
      AND object_id = OBJECT_ID('app.ConfigEditSessions')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_ConfigEditSessions_App_Scope_Active
        ON app.ConfigEditSessions (ApplicationId, RuleScope, IsActive)
        INCLUDE (UserId, DisplayName, SessionStart, LastHeartbeat);
END;

-- Filtered unique index: one active session per user per (application, scope)
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UQ_ConfigEditSessions_ActiveUserSession'
      AND object_id = OBJECT_ID('app.ConfigEditSessions')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UQ_ConfigEditSessions_ActiveUserSession
        ON app.ConfigEditSessions (ApplicationId, RuleScope, UserId)
        WHERE IsActive = 1;
END;
