SET NOCOUNT ON;

MERGE app.Applications AS target
USING (
    SELECT CAST('10000000-0000-0000-0000-000000000001' AS UNIQUEIDENTIFIER) AS ApplicationId, 'Maestro' AS ApplicationName, 'Engagement' AS AdoptionLevel, 'engagement_id' AS MatchKey, 'Tax' AS ServiceLine, 'PCS' AS SubServiceLine, 'Maestro application' AS [Description]
    UNION ALL SELECT CAST('10000000-0000-0000-0000-000000000002' AS UNIQUEIDENTIFIER), 'EYST', 'Client', 'client_id', 'Tax', 'FTTS', 'EYST application'
    UNION ALL SELECT CAST('10000000-0000-0000-0000-000000000003' AS UNIQUEIDENTIFIER), 'Prodigy', 'Client', 'client_id', 'Tax', 'R&D', 'Prodigy application'
    UNION ALL SELECT CAST('10000000-0000-0000-0000-000000000004' AS UNIQUEIDENTIFIER), 'Vector', 'Engagement', 'engagement_id', 'Tax', 'Tech', 'Vector application'
    UNION ALL SELECT CAST('10000000-0000-0000-0000-000000000005' AS UNIQUEIDENTIFIER), 'Navigate', 'Engagement', 'engagement_id', 'Tax', 'Planner', 'Navigate application'
) AS src
ON target.ApplicationName = src.ApplicationName
WHEN MATCHED THEN
    UPDATE SET
        target.AdoptionLevel = src.AdoptionLevel,
        target.MatchKey = src.MatchKey,
        target.ServiceLine = src.ServiceLine,
        target.SubServiceLine = src.SubServiceLine,
        target.[Description] = src.[Description],
        target.IsActive = 1,
        target.UpdateDate = SYSUTCDATETIME(),
        target.UpdatedBy = SUSER_SNAME()
WHEN NOT MATCHED THEN
    INSERT (ApplicationId, ApplicationName, AdoptionLevel, MatchKey, ServiceLine, SubServiceLine, [Description], IsActive, CreateDate, CreatedBy, UpdateDate, UpdatedBy)
    VALUES (src.ApplicationId, src.ApplicationName, src.AdoptionLevel, src.MatchKey, src.ServiceLine, src.SubServiceLine, src.[Description], 1, SYSUTCDATETIME(), SUSER_SNAME(), SYSUTCDATETIME(), SUSER_SNAME());
