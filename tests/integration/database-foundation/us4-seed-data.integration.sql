SET NOCOUNT ON;

DECLARE @AppCountBefore INT = (SELECT COUNT(*) FROM app.Applications);
DECLARE @RoleCountBefore INT = (SELECT COUNT(*) FROM app.Roles);
DECLARE @UserCountBefore INT = (SELECT COUNT(*) FROM app.Users);

-- Run seed wrapper twice to validate idempotency.
:r ..\..\..\database\migrations\005_run_seed_scripts.sql
:r ..\..\..\database\migrations\005_run_seed_scripts.sql

DECLARE @AppCountAfter INT = (SELECT COUNT(*) FROM app.Applications);
DECLARE @RoleCountAfter INT = (SELECT COUNT(*) FROM app.Roles);
DECLARE @UserCountAfter INT = (SELECT COUNT(*) FROM app.Users);

IF @AppCountAfter < 5 OR @RoleCountAfter < 3 OR @UserCountAfter < 1
    THROW 51000, 'Seed baseline counts invalid after rerun', 1;

IF (SELECT COUNT(*) FROM app.Applications WHERE ApplicationName IN ('Maestro','EYST','Prodigy','Vector','Navigate')) <> 5
    THROW 51000, 'Application seed set is not stable', 1;

IF (SELECT COUNT(*) FROM app.Roles WHERE RoleName IN ('administrator','application_owner','viewer')) <> 3
    THROW 51000, 'Role seed set is not stable', 1;

SELECT 'US4 integration checks passed' AS Result;
