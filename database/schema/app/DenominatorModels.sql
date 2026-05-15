IF OBJECT_ID('app.DenominatorModels', 'U') IS NULL
BEGIN
    CREATE TABLE app.DenominatorModels
    (
        DenominatorModelId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_DenominatorModels PRIMARY KEY,
        FieldName NVARCHAR(128) NOT NULL,
        FieldType NVARCHAR(32) NOT NULL,
        SourceColumn NVARCHAR(256) NOT NULL,
        IsFilterable BIT NOT NULL CONSTRAINT DF_DenominatorModels_IsFilterable DEFAULT (1),
        DisplayOrder INT NOT NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_DenominatorModels_IsActive DEFAULT (1),
        CreateDate DATETIME2 NOT NULL CONSTRAINT DF_DenominatorModels_CreateDate DEFAULT (SYSUTCDATETIME()),
        CreatedBy NVARCHAR(255) NOT NULL CONSTRAINT DF_DenominatorModels_CreatedBy DEFAULT (SUSER_SNAME()),
        UpdateDate DATETIME2 NOT NULL CONSTRAINT DF_DenominatorModels_UpdateDate DEFAULT (SYSUTCDATETIME()),
        UpdatedBy NVARCHAR(255) NOT NULL CONSTRAINT DF_DenominatorModels_UpdatedBy DEFAULT (SUSER_SNAME()),
        CONSTRAINT UQ_DenominatorModels_FieldName UNIQUE (FieldName),
        CONSTRAINT CK_DenominatorModels_FieldType CHECK (FieldType IN ('text', 'numeric', 'date')),
        CONSTRAINT CK_DenominatorModels_DisplayOrder CHECK (DisplayOrder >= 1)
    );
END;
