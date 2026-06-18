SET NOCOUNT ON;

-- Rollback 032: Drop app.ConfigVersions
IF OBJECT_ID('app.ConfigVersions', 'U') IS NOT NULL
    DROP TABLE app.ConfigVersions;
