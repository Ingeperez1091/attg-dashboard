SET NOCOUNT ON;

DECLARE @AppId UNIQUEIDENTIFIER = NEWID();
DECLARE @RoleId UNIQUEIDENTIFIER = NEWID();
DECLARE @UserId UNIQUEIDENTIFIER = NEWID();

BEGIN TRAN;

INSERT INTO app.Applications
(ApplicationId, ApplicationName, AdoptionLevel, MatchKey, ServiceLine, SubServiceLine, Description, IsActive, CreateDate, CreatedBy, UpdateDate, UpdatedBy)
VALUES
(@AppId, CONCAT('tmp-app-', CONVERT(NVARCHAR(36), @AppId)), 'Engagement', 'engagement_id', 'Tax', 'General', 'tmp', 1, SYSUTCDATETIME(), SUSER_SNAME(), SYSUTCDATETIME(), SUSER_SNAME());

INSERT INTO app.Roles
(RoleId, RoleName, Description, PermissionLevel, IsActive, CreateDate, CreatedBy, UpdateDate, UpdatedBy)
VALUES
(@RoleId, CONCAT('tmp-role-', CONVERT(NVARCHAR(36), @RoleId)), 'tmp', 1, 1, SYSUTCDATETIME(), SUSER_SNAME(), SYSUTCDATETIME(), SUSER_SNAME());

INSERT INTO app.Users
(UserId, Username, Email, AzureADObjectId, DisplayName, IsActive, CreateDate, CreatedBy, UpdateDate, UpdatedBy)
VALUES
(@UserId, CONCAT('tmp-user-', CONVERT(NVARCHAR(36), @UserId)), CONCAT('tmp-', CONVERT(NVARCHAR(36), @UserId), '@example.com'), NULL, 'tmp', 1, SYSUTCDATETIME(), SUSER_SNAME(), SYSUTCDATETIME(), SUSER_SNAME());

INSERT INTO app.UserRoles
(UserRoleId, UserId, RoleId, AssignedDate, AssignedBy, CreateDate, CreatedBy, UpdateDate, UpdatedBy)
VALUES
(NEWID(), @UserId, @RoleId, SYSUTCDATETIME(), SUSER_SNAME(), SYSUTCDATETIME(), SUSER_SNAME(), SYSUTCDATETIME(), SUSER_SNAME());

INSERT INTO app.UserApplications
(UserApplicationId, UserId, ApplicationId, AssignedDate, AssignedBy, CreateDate, CreatedBy, UpdateDate, UpdatedBy)
VALUES
(NEWID(), @UserId, @AppId, SYSUTCDATETIME(), SUSER_SNAME(), SYSUTCDATETIME(), SUSER_SNAME(), SYSUTCDATETIME(), SUSER_SNAME());

SELECT 'US1 integration checks passed' AS Result;

ROLLBACK TRAN;
