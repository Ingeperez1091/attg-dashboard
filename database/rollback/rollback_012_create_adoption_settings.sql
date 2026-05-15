SET NOCOUNT ON;

IF OBJECT_ID('app.AdoptionSettings', 'U') IS NOT NULL
BEGIN
    DROP TABLE app.AdoptionSettings;
END;
