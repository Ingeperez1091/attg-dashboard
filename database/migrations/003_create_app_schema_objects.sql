SET NOCOUNT ON;

:r ..\schema\app\Applications.sql
:r ..\schema\app\Roles.sql
:r ..\schema\app\Users.sql
:r ..\schema\app\UserRoles.sql
:r ..\schema\app\UserApplications.sql

-- If sqlcmd include syntax is not available, execute the five table scripts manually in this same order.

IF OBJECT_ID('app.TR_Applications_UpdateAudit', 'TR') IS NULL
	EXEC('CREATE TRIGGER app.TR_Applications_UpdateAudit ON app.Applications AFTER UPDATE AS BEGIN SET NOCOUNT ON; UPDATE a SET UpdateDate = SYSUTCDATETIME(), UpdatedBy = SUSER_SNAME() FROM app.Applications a JOIN inserted i ON a.ApplicationId = i.ApplicationId; END;');

IF OBJECT_ID('app.TR_Roles_UpdateAudit', 'TR') IS NULL
	EXEC('CREATE TRIGGER app.TR_Roles_UpdateAudit ON app.Roles AFTER UPDATE AS BEGIN SET NOCOUNT ON; UPDATE r SET UpdateDate = SYSUTCDATETIME(), UpdatedBy = SUSER_SNAME() FROM app.Roles r JOIN inserted i ON r.RoleId = i.RoleId; END;');

IF OBJECT_ID('app.TR_Users_UpdateAudit', 'TR') IS NULL
	EXEC('CREATE TRIGGER app.TR_Users_UpdateAudit ON app.Users AFTER UPDATE AS BEGIN SET NOCOUNT ON; UPDATE u SET UpdateDate = SYSUTCDATETIME(), UpdatedBy = SUSER_SNAME() FROM app.Users u JOIN inserted i ON u.UserId = i.UserId; END;');

IF OBJECT_ID('app.TR_UserRoles_UpdateAudit', 'TR') IS NULL
	EXEC('CREATE TRIGGER app.TR_UserRoles_UpdateAudit ON app.UserRoles AFTER UPDATE AS BEGIN SET NOCOUNT ON; UPDATE ur SET UpdateDate = SYSUTCDATETIME(), UpdatedBy = SUSER_SNAME() FROM app.UserRoles ur JOIN inserted i ON ur.UserRoleId = i.UserRoleId; END;');

IF OBJECT_ID('app.TR_UserApplications_UpdateAudit', 'TR') IS NULL
	EXEC('CREATE TRIGGER app.TR_UserApplications_UpdateAudit ON app.UserApplications AFTER UPDATE AS BEGIN SET NOCOUNT ON; UPDATE ua SET UpdateDate = SYSUTCDATETIME(), UpdatedBy = SUSER_SNAME() FROM app.UserApplications ua JOIN inserted i ON ua.UserApplicationId = i.UserApplicationId; END;');
