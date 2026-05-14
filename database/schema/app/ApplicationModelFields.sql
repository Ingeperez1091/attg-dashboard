IF OBJECT_ID('app.ApplicationModelFields', 'U') IS NULL
BEGIN
    CREATE TABLE app.ApplicationModelFields
    (
        ApplicationModelFieldId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ApplicationModelFields PRIMARY KEY,
        ApplicationId UNIQUEIDENTIFIER NOT NULL,
        FieldName NVARCHAR(128) NOT NULL,
        FieldType NVARCHAR(20) NOT NULL,
        SourcePath NVARCHAR(512) NOT NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_ApplicationModelFields_IsActive DEFAULT (1),
        IsFilterable BIT NOT NULL CONSTRAINT DF_ApplicationModelFields_IsFilterable DEFAULT (1),
        IsMetricDimension BIT NOT NULL CONSTRAINT DF_ApplicationModelFields_IsMetricDimension DEFAULT (0),
        DisplayOrder INT NOT NULL CONSTRAINT DF_ApplicationModelFields_DisplayOrder DEFAULT (0),
        CreateDate DATETIME2 NOT NULL CONSTRAINT DF_ApplicationModelFields_CreateDate DEFAULT (SYSUTCDATETIME()),
        CreatedBy NVARCHAR(255) NOT NULL CONSTRAINT DF_ApplicationModelFields_CreatedBy DEFAULT (SUSER_SNAME()),
        UpdateDate DATETIME2 NOT NULL CONSTRAINT DF_ApplicationModelFields_UpdateDate DEFAULT (SYSUTCDATETIME()),
        UpdatedBy NVARCHAR(255) NOT NULL CONSTRAINT DF_ApplicationModelFields_UpdatedBy DEFAULT (SUSER_SNAME()),
        CONSTRAINT FK_ApplicationModelFields_Applications FOREIGN KEY (ApplicationId) REFERENCES app.Applications(ApplicationId),
        CONSTRAINT UQ_ApplicationModelFields_Application_Field UNIQUE (ApplicationId, FieldName),
        CONSTRAINT CK_ApplicationModelFields_FieldType CHECK (FieldType IN ('text', 'numeric', 'boolean', 'date')),
        CONSTRAINT CK_ApplicationModelFields_DisplayOrder CHECK (DisplayOrder >= 0)
    );
END;
