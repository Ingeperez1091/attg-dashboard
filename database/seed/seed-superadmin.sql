SET NOCOUNT ON;

DECLARE @SuperAdminId UNIQUEIDENTIFIER = '30000000-0000-0000-0000-000000000001';
DECLARE @AdminRoleId UNIQUEIDENTIFIER;

SELECT @AdminRoleId = RoleId FROM app.Roles WHERE RoleName = 'administrator';
IF @AdminRoleId IS NULL THROW 51000, 'administrator role not found before super-admin seed', 1;

MERGE app.Users AS target
USING (SELECT @SuperAdminId AS UserId, 'super-admin' AS Username, 'super-admin@local' AS Email, 'Super Admin' AS DisplayName) AS src
ON target.Username = src.Username
WHEN MATCHED THEN
    UPDATE SET
        target.Email = src.Email,
        target.DisplayName = src.DisplayName,
        target.IsActive = 1,
        target.UpdateDate = SYSUTCDATETIME(),
        target.UpdatedBy = SUSER_SNAME()
WHEN NOT MATCHED THEN
    INSERT (UserId, Username, Email, AzureADObjectId, DisplayName, IsActive, CreateDate, CreatedBy, UpdateDate, UpdatedBy)
    VALUES (src.UserId, src.Username, src.Email, NULL, src.DisplayName, 1, SYSUTCDATETIME(), SUSER_SNAME(), SYSUTCDATETIME(), SUSER_SNAME());

IF NOT EXISTS (SELECT 1 FROM app.UserRoles WHERE UserId = @SuperAdminId)
BEGIN
    INSERT INTO app.UserRoles
    (UserRoleId, UserId, RoleId, AssignedDate, AssignedBy, CreateDate, CreatedBy, UpdateDate, UpdatedBy)
    VALUES
    (NEWID(), @SuperAdminId, @AdminRoleId, SYSUTCDATETIME(), SUSER_SNAME(), SYSUTCDATETIME(), SUSER_SNAME(), SYSUTCDATETIME(), SUSER_SNAME());
END;

INSERT INTO app.UserApplications
(UserApplicationId, UserId, ApplicationId, AssignedDate, AssignedBy, CreateDate, CreatedBy, UpdateDate, UpdatedBy)
SELECT NEWID(), @SuperAdminId, a.ApplicationId, SYSUTCDATETIME(), SUSER_SNAME(), SYSUTCDATETIME(), SUSER_SNAME(), SYSUTCDATETIME(), SUSER_SNAME()
FROM app.Applications a
WHERE NOT EXISTS (
    SELECT 1 FROM app.UserApplications ua
    WHERE ua.UserId = @SuperAdminId
      AND ua.ApplicationId = a.ApplicationId
);
