SET NOCOUNT ON;

IF OBJECT_ID('app.Applications', 'U') IS NULL THROW 51000, 'Missing app.Applications', 1;
IF OBJECT_ID('app.Roles', 'U') IS NULL THROW 51000, 'Missing app.Roles', 1;
IF OBJECT_ID('app.Users', 'U') IS NULL THROW 51000, 'Missing app.Users', 1;
IF OBJECT_ID('app.UserRoles', 'U') IS NULL THROW 51000, 'Missing app.UserRoles', 1;
IF OBJECT_ID('app.UserApplications', 'U') IS NULL THROW 51000, 'Missing app.UserApplications', 1;

IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE parent_object_id = OBJECT_ID('app.UserRoles') AND [type] = 'PK')
    THROW 51000, 'UserRoles primary key missing', 1;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('app.UserRoles') AND is_unique = 1 AND name = 'UQ_UserRoles_UserId')
    THROW 51000, 'One-role-per-user unique constraint missing', 1;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('app.UserApplications') AND is_unique = 1 AND name = 'UQ_UserApplications_User_Application')
    THROW 51000, 'Duplicate assignment protection missing', 1;

SELECT 'US1 contract checks passed' AS Result;
