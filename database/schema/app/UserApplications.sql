IF OBJECT_ID('app.UserApplications', 'U') IS NULL
BEGIN
    CREATE TABLE app.UserApplications
    (
        UserApplicationId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_UserApplications PRIMARY KEY,
        UserId UNIQUEIDENTIFIER NOT NULL,
        ApplicationId UNIQUEIDENTIFIER NOT NULL,
        AssignedDate DATETIME2 NOT NULL CONSTRAINT DF_UserApplications_AssignedDate DEFAULT (SYSUTCDATETIME()),
        AssignedBy NVARCHAR(255) NOT NULL,
        CreateDate DATETIME2 NOT NULL CONSTRAINT DF_UserApplications_CreateDate DEFAULT (SYSUTCDATETIME()),
        CreatedBy NVARCHAR(255) NOT NULL CONSTRAINT DF_UserApplications_CreatedBy DEFAULT (SUSER_SNAME()),
        UpdateDate DATETIME2 NOT NULL CONSTRAINT DF_UserApplications_UpdateDate DEFAULT (SYSUTCDATETIME()),
        UpdatedBy NVARCHAR(255) NOT NULL CONSTRAINT DF_UserApplications_UpdatedBy DEFAULT (SUSER_SNAME()),
        CONSTRAINT FK_UserApplications_Users FOREIGN KEY (UserId) REFERENCES app.Users(UserId),
        CONSTRAINT FK_UserApplications_Applications FOREIGN KEY (ApplicationId) REFERENCES app.Applications(ApplicationId),
        CONSTRAINT UQ_UserApplications_User_Application UNIQUE (UserId, ApplicationId)
    );
END;
