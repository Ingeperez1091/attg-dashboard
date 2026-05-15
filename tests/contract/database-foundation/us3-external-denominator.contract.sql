SET NOCOUNT ON;

/*
Run this test in the Mercury-connected database context.
The script validates required columns are available in vw_USTaxBTS_FY26_MaxACD.
*/

SELECT TOP (0)
    [AccountingCycleDate],
    [EngagementID],
    [Engagement],
    [ClientID],
    [Client],
    [AccountChannel],
    [EngagementSubServiceLine],
    [EngagementServiceCode],
    [EngagementService],
    [EngagementStatus],
    [CreationDate],
    [ReleaseDate],
    [ETD_ANSRAmt],
    [FYTD_ANSRAmt],
    [ETD_TERAmt],
    [FYTD_TERAmt],
    [ETD_ChargedHours],
    [FYTD_ChargedHours]
FROM vw_USTaxBTS_FY26_MaxACD;

SELECT 'US3 contract checks passed' AS Result;
