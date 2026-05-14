SET NOCOUNT ON;

DELETE FROM app.AdoptionSettings
WHERE SettingId LIKE '70000000-0000-0000-%';

DELETE FROM app.DenominatorModels
WHERE DenominatorModelId LIKE '50000000-0000-0000-%';
