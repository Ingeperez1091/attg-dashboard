SET NOCOUNT ON;

IF (SELECT COUNT(*) FROM app.Applications WHERE ApplicationName IN ('Maestro','EYST','Prodigy','Vector','Navigate')) <> 5
    THROW 51000, 'Expected 5 seeded applications', 1;

IF (SELECT COUNT(*) FROM app.Roles WHERE RoleName IN ('administrator','application_owner','viewer')) <> 3
    THROW 51000, 'Expected 3 seeded roles', 1;

IF (SELECT COUNT(*) FROM app.Users WHERE Username = 'super-admin') <> 1
    THROW 51000, 'Expected super-admin user', 1;

IF EXISTS (
    SELECT ur.UserId
    FROM app.UserRoles ur
    GROUP BY ur.UserId
    HAVING COUNT(*) > 1
)
    THROW 51000, 'One-role-per-user violated', 1;

SELECT 'US4 contract checks passed' AS Result;
