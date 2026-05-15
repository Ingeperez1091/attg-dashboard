SET NOCOUNT ON;

MERGE app.Roles AS target
USING (
    SELECT CAST('20000000-0000-0000-0000-000000000001' AS UNIQUEIDENTIFIER) AS RoleId, 'administrator' AS RoleName, 'Full administrative access' AS [Description], 100 AS PermissionLevel
    UNION ALL SELECT CAST('20000000-0000-0000-0000-000000000002' AS UNIQUEIDENTIFIER), 'application_owner', 'Own app configuration and visibility', 50
    UNION ALL SELECT CAST('20000000-0000-0000-0000-000000000003' AS UNIQUEIDENTIFIER), 'viewer', 'Read-only application access', 10
) AS src
ON target.RoleName = src.RoleName
WHEN MATCHED THEN
    UPDATE SET
        target.[Description] = src.[Description],
        target.PermissionLevel = src.PermissionLevel,
        target.IsActive = 1,
        target.UpdateDate = SYSUTCDATETIME(),
        target.UpdatedBy = SUSER_SNAME()
WHEN NOT MATCHED THEN
    INSERT (RoleId, RoleName, [Description], PermissionLevel, IsActive, CreateDate, CreatedBy, UpdateDate, UpdatedBy)
    VALUES (src.RoleId, src.RoleName, src.[Description], src.PermissionLevel, 1, SYSUTCDATETIME(), SUSER_SNAME(), SYSUTCDATETIME(), SUSER_SNAME());
