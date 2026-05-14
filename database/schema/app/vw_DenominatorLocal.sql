IF OBJECT_ID('app.vw_DenominatorLocal', 'V') IS NOT NULL
BEGIN
    DROP VIEW app.vw_DenominatorLocal;
END;

EXEC ('
CREATE VIEW app.vw_DenominatorLocal
AS
SELECT
    SnapshotId,
    EngagementID,
    Engagement,
    ClientID,
    Client,
    AccountChannel,
    EngagementSubServiceLine,
    EngagementServiceCode,
    EngagementService,
    EngagementStatus,
    CreationDate,
    ReleaseDate,
    ETD_ANSRAmt,
    FYTD_ANSRAmt,
    ETD_TERAmt,
    FYTD_TERAmt,
    ETD_ChargedHours,
    FYTD_ChargedHours,
    LoadDate
FROM stage.DenominatorSnapshot;
');
