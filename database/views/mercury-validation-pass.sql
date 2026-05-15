SET NOCOUNT ON;

PRINT '=== Mercury External View Connectivity Check ===';

BEGIN TRY
    DECLARE @ProbeSql NVARCHAR(MAX) = N'
        SELECT TOP (5)
            [AccountingCycleDate], [EngagementID], [Engagement], [ClientID], [Client],
            [AccountChannel], [EngagementSubServiceLine], [EngagementServiceCode], [EngagementService],
            [EngagementStatus], [CreationDate], [ReleaseDate], [ETD_ANSRAmt], [FYTD_ANSRAmt],
            [ETD_TERAmt], [FYTD_TERAmt], [ETD_ChargedHours], [FYTD_ChargedHours]
        FROM vw_USTaxBTS_FY26_MaxACD;';

    EXEC sp_executesql @ProbeSql;

    SELECT 'PASS' AS MercuryValidationStatus,
           'View is reachable and required columns are readable.' AS Details;
END TRY
BEGIN CATCH
    SELECT 'FAIL' AS MercuryValidationStatus,
           ERROR_NUMBER() AS ErrorNumber,
           ERROR_MESSAGE() AS ErrorMessage;
END CATCH;
