SET NOCOUNT ON;

/*
Run this test in the Mercury-connected database context.
*/

BEGIN TRY
    SELECT TOP (10) *
    FROM vw_USTaxBTS_FY26_MaxACD;

    SELECT 'US3 integration checks passed' AS Result;
END TRY
BEGIN CATCH
    DECLARE @Message NVARCHAR(4000) = ERROR_MESSAGE();
    THROW 51000, CONCAT('Mercury connectivity/readability check failed: ', @Message), 1;
END CATCH;
