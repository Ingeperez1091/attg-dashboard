SET NOCOUNT ON;

DECLARE @seedActor NVARCHAR(128) = SUSER_SNAME();
DECLARE @seedDate DATE = '2026-01-01';
DECLARE @sourceBatchId NVARCHAR(256) = CONCAT('epic-007-seed-', CONVERT(VARCHAR(8), @seedDate, 112));

;WITH app_base AS (
	SELECT
		a.ApplicationId,
		ROW_NUMBER() OVER (ORDER BY a.ApplicationId) AS sequence_no
	FROM app.Applications a
	WHERE a.IsActive = 1
),
seed_rows AS (
	SELECT
		NEWID() AS InvestmentId,
		b.ApplicationId,
		@seedDate AS CalculationDate,
		CAST(50000 + (b.sequence_no * 12500) AS DECIMAL(18, 2)) AS InvestmentAmount,
		CAST(1 AS BIT) AS IsSynthetic,
		CONCAT(CONVERT(NVARCHAR(36), b.ApplicationId), '|', CONVERT(NVARCHAR(10), @seedDate, 23), '|EPIC007') AS SyntheticBusinessKey,
		@sourceBatchId AS SourceBatchId,
		@seedActor AS AuditActor
	FROM app_base b
)
MERGE app.InvestmentDummyFacts AS target
USING seed_rows AS source
ON target.SyntheticBusinessKey = source.SyntheticBusinessKey
WHEN MATCHED THEN
	UPDATE SET
		target.InvestmentAmount = source.InvestmentAmount,
		target.IsSynthetic = 1,
		target.SourceBatchId = source.SourceBatchId,
		target.UpdateDate = SYSUTCDATETIME(),
		target.UpdatedBy = source.AuditActor
WHEN NOT MATCHED THEN
	INSERT (
		InvestmentId,
		ApplicationId,
		CalculationDate,
		InvestmentAmount,
		IsSynthetic,
		SyntheticBusinessKey,
		SourceBatchId,
		CreateDate,
		CreatedBy,
		UpdateDate,
		UpdatedBy
	)
	VALUES (
		source.InvestmentId,
		source.ApplicationId,
		source.CalculationDate,
		source.InvestmentAmount,
		source.IsSynthetic,
		source.SyntheticBusinessKey,
		source.SourceBatchId,
		SYSUTCDATETIME(),
		source.AuditActor,
		SYSUTCDATETIME(),
		source.AuditActor
	);
