IF OBJECT_ID('app.InvestmentDummyFacts', 'U') IS NULL
BEGIN
    CREATE TABLE app.InvestmentDummyFacts (
        InvestmentId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_InvestmentDummyFacts PRIMARY KEY,
        ApplicationId UNIQUEIDENTIFIER NOT NULL,
        CalculationDate DATE NOT NULL,
        InvestmentAmount DECIMAL(18, 2) NOT NULL,
        IsSynthetic BIT NOT NULL CONSTRAINT DF_InvestmentDummyFacts_IsSynthetic DEFAULT (1),
        SyntheticBusinessKey NVARCHAR(256) NOT NULL,
        SourceBatchId NVARCHAR(256) NULL,
        CreateDate DATETIME2 NOT NULL CONSTRAINT DF_InvestmentDummyFacts_CreateDate DEFAULT (SYSUTCDATETIME()),
        CreatedBy NVARCHAR(128) NOT NULL,
        UpdateDate DATETIME2 NOT NULL CONSTRAINT DF_InvestmentDummyFacts_UpdateDate DEFAULT (SYSUTCDATETIME()),
        UpdatedBy NVARCHAR(128) NOT NULL,
        CONSTRAINT FK_InvestmentDummyFacts_ApplicationId FOREIGN KEY (ApplicationId) REFERENCES app.Applications (ApplicationId),
        CONSTRAINT CHK_InvestmentDummyFacts_IsSynthetic CHECK (IsSynthetic = 1)
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UX_InvestmentDummyFacts_SyntheticBusinessKey'
      AND object_id = OBJECT_ID('app.InvestmentDummyFacts')
)
BEGIN
    CREATE UNIQUE INDEX UX_InvestmentDummyFacts_SyntheticBusinessKey
        ON app.InvestmentDummyFacts (SyntheticBusinessKey);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_InvestmentDummyFacts_Application_CalculationDate'
      AND object_id = OBJECT_ID('app.InvestmentDummyFacts')
)
BEGIN
    CREATE INDEX IX_InvestmentDummyFacts_Application_CalculationDate
        ON app.InvestmentDummyFacts (ApplicationId, CalculationDate);
END;
