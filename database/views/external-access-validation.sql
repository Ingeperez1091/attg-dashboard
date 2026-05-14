SET NOCOUNT ON;

PRINT '=== Local Schema Validation ===';

SELECT TABLE_SCHEMA, TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA IN ('app', 'stage')
ORDER BY TABLE_SCHEMA, TABLE_NAME;

PRINT '=== Audit Column Validation (app schema) ===';

SELECT TABLE_NAME, COLUMN_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'app'
  AND COLUMN_NAME IN ('CreateDate', 'CreatedBy', 'UpdateDate', 'UpdatedBy')
ORDER BY TABLE_NAME, COLUMN_NAME;

PRINT '=== Core Constraint Validation ===';

SELECT
        t.name AS TableName,
        i.name AS UniqueIndexName
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id = t.schema_id
JOIN sys.indexes i ON i.object_id = t.object_id
WHERE s.name = 'app'
    AND i.is_unique = 1
    AND i.name IN ('UQ_UserRoles_UserId', 'UQ_UserApplications_User_Application')
ORDER BY t.name;

PRINT '=== Staging Structure Validation ===';

SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'stage'
    AND TABLE_NAME = 'EngagementUsageRaw'
ORDER BY ORDINAL_POSITION;

SELECT
        CASE WHEN EXISTS (
                SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA='stage' AND TABLE_NAME='EngagementUsageRaw' AND COLUMN_NAME IN ('UpdateDate','UpdatedBy')
        ) THEN 'FAIL' ELSE 'PASS' END AS StagingAppendOnlyCheck;

PRINT '=== Seed Count Validation ===';

IF OBJECT_ID('app.Applications', 'U') IS NOT NULL
    SELECT COUNT(*) AS ApplicationCount FROM app.Applications;
IF OBJECT_ID('app.Roles', 'U') IS NOT NULL
    SELECT COUNT(*) AS RoleCount FROM app.Roles;
IF OBJECT_ID('app.Users', 'U') IS NOT NULL
    SELECT COUNT(*) AS UserCount FROM app.Users;

IF OBJECT_ID('app.UserRoles', 'U') IS NOT NULL
    SELECT COUNT(*) AS UserRolesCount FROM app.UserRoles;

IF OBJECT_ID('app.UserApplications', 'U') IS NOT NULL
    SELECT COUNT(*) AS UserApplicationsCount FROM app.UserApplications;

PRINT '=== Seed Integrity Validation ===';

IF OBJECT_ID('app.Users', 'U') IS NOT NULL AND OBJECT_ID('app.UserRoles', 'U') IS NOT NULL
BEGIN
    SELECT
        CASE WHEN EXISTS (
            SELECT UserId FROM app.UserRoles GROUP BY UserId HAVING COUNT(*) > 1
        ) THEN 'FAIL' ELSE 'PASS' END AS OneRolePerUserCheck;
END;

IF OBJECT_ID('app.Users', 'U') IS NOT NULL AND OBJECT_ID('app.UserApplications', 'U') IS NOT NULL
BEGIN
    SELECT
        CASE WHEN EXISTS (SELECT 1 FROM app.Users WHERE Username='super-admin') THEN 'PASS' ELSE 'FAIL' END AS SuperAdminExists,
        (SELECT COUNT(*) FROM app.UserApplications ua JOIN app.Users u ON ua.UserId = u.UserId WHERE u.Username='super-admin') AS SuperAdminApplicationAssignments;
END;

PRINT '=== External Mercury Validation (manual execution context) ===';
PRINT 'Run in the Mercury-connected context:';
PRINT 'SELECT TOP (10) [AccountingCycleDate],[EngagementID],[Engagement],[ClientID],[Client],[AccountChannel],[EngagementSubServiceLine],[EngagementServiceCode],[EngagementService],[EngagementStatus],[CreationDate],[ReleaseDate],[ETD_ANSRAmt],[FYTD_ANSRAmt],[ETD_TERAmt],[FYTD_TERAmt],[ETD_ChargedHours],[FYTD_ChargedHours] FROM vw_USTaxBTS_FY26_MaxACD;';

BEGIN TRY
    DECLARE @ExternalSql NVARCHAR(MAX) = N'
        SELECT TOP (1)
            [AccountingCycleDate], [EngagementID], [Engagement], [ClientID], [Client],
            [AccountChannel], [EngagementSubServiceLine], [EngagementServiceCode], [EngagementService],
            [EngagementStatus], [CreationDate], [ReleaseDate], [ETD_ANSRAmt], [FYTD_ANSRAmt],
            [ETD_TERAmt], [FYTD_TERAmt], [ETD_ChargedHours], [FYTD_ChargedHours]
        FROM vw_USTaxBTS_FY26_MaxACD;';

    EXEC sp_executesql @ExternalSql;

    SELECT 'PASS' AS ExternalMercuryReadCheck;
END TRY
BEGIN CATCH
    SELECT CONCAT('FAIL: ', ERROR_MESSAGE()) AS ExternalMercuryReadCheck;
END CATCH;
