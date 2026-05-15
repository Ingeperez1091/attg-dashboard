SET NOCOUNT ON;

MERGE app.DenominatorModels AS target
USING (
    VALUES
        ('50000000-0000-0000-0001-000000000000','EngagementID','text','[EngagementID]',0,1),
        ('50000000-0000-0000-0002-000000000000','Engagement','text','[Engagement]',1,2),
        ('50000000-0000-0000-0003-000000000000','ClientID','text','[ClientID]',0,3),
        ('50000000-0000-0000-0004-000000000000','Client','text','[Client]',1,4),
        ('50000000-0000-0000-0005-000000000000','AccountChannel','text','[AccountChannel]',1,5),
        ('50000000-0000-0000-0006-000000000000','EngagementSubServiceLine','text','[EngagementSubServiceLine]',1,6),
        ('50000000-0000-0000-0007-000000000000','EngagementServiceCode','text','[EngagementServiceCode]',1,7),
        ('50000000-0000-0000-0008-000000000000','EngagementService','text','[EngagementService]',0,8),
        ('50000000-0000-0000-0009-000000000000','EngagementStatus','text','[EngagementStatus]',1,9),
        ('50000000-0000-0000-000A-000000000000','CreationDate','date','[CreationDate]',1,10),
        ('50000000-0000-0000-000B-000000000000','ReleaseDate','date','[ReleaseDate]',1,11),
        ('50000000-0000-0000-000C-000000000000','ETD_ANSRAmt','numeric','[ETD_ANSRAmt]',1,12),
        ('50000000-0000-0000-000D-000000000000','FYTD_ANSRAmt','numeric','[FYTD_ANSRAmt]',1,13),
        ('50000000-0000-0000-000E-000000000000','ETD_TERAmt','numeric','[ETD_TERAmt]',1,14),
        ('50000000-0000-0000-000F-000000000000','FYTD_TERAmt','numeric','[FYTD_TERAmt]',1,15),
        ('50000000-0000-0000-0010-000000000000','ETD_ChargedHours','numeric','[ETD_ChargedHours]',0,16),
        ('50000000-0000-0000-0011-000000000000','FYTD_ChargedHours','numeric','[FYTD_ChargedHours]',0,17)
) AS source (
    DenominatorModelId,
    FieldName,
    FieldType,
    SourceColumn,
    IsFilterable,
    DisplayOrder
)
ON target.DenominatorModelId = source.DenominatorModelId
WHEN MATCHED THEN
    UPDATE SET
        target.FieldName = source.FieldName,
        target.FieldType = source.FieldType,
        target.SourceColumn = source.SourceColumn,
        target.IsFilterable = source.IsFilterable,
        target.DisplayOrder = source.DisplayOrder,
        target.IsActive = 1,
        target.UpdateDate = SYSUTCDATETIME(),
        target.UpdatedBy = SUSER_SNAME()
WHEN NOT MATCHED THEN
    INSERT (
        DenominatorModelId,
        FieldName,
        FieldType,
        SourceColumn,
        IsFilterable,
        DisplayOrder,
        IsActive,
        CreateDate,
        CreatedBy,
        UpdateDate,
        UpdatedBy
    )
    VALUES (
        source.DenominatorModelId,
        source.FieldName,
        source.FieldType,
        source.SourceColumn,
        source.IsFilterable,
        source.DisplayOrder,
        1,
        SYSUTCDATETIME(),
        SUSER_SNAME(),
        SYSUTCDATETIME(),
        SUSER_SNAME()
    );

MERGE app.AdoptionSettings AS target
USING (
    VALUES
        ('70000000-0000-0000-0001-000000000000','10000000-0000-0000-0000-000000000001','Engagement','ETD_ANSRAmt','API'),
        ('70000000-0000-0000-0002-000000000000','10000000-0000-0000-0000-000000000002','Client','ETD_ANSRAmt','API'),
        ('70000000-0000-0000-0003-000000000000','10000000-0000-0000-0000-000000000003','Client','ETD_ANSRAmt','API'),
        ('70000000-0000-0000-0004-000000000000','10000000-0000-0000-0000-000000000004','Engagement','ETD_ANSRAmt','API'),
        ('70000000-0000-0000-0005-000000000000','10000000-0000-0000-0000-000000000005','Engagement','FYTD_ANSRAmt','API')
) AS source (
    SettingId,
    ApplicationId,
    AdoptionLevel,
    RevenueMetric,
    NumeratorSource
)
ON target.ApplicationId = source.ApplicationId
WHEN MATCHED THEN
    UPDATE SET
        target.AdoptionLevel = source.AdoptionLevel,
        target.RevenueMetric = source.RevenueMetric,
        target.NumeratorSource = source.NumeratorSource,
        target.UpdateDate = SYSUTCDATETIME(),
        target.UpdatedBy = SUSER_SNAME()
WHEN NOT MATCHED THEN
    INSERT (
        SettingId,
        ApplicationId,
        AdoptionLevel,
        RevenueMetric,
        NumeratorSource,
        CreateDate,
        CreatedBy,
        UpdateDate,
        UpdatedBy
    )
    VALUES (
        source.SettingId,
        source.ApplicationId,
        source.AdoptionLevel,
        source.RevenueMetric,
        source.NumeratorSource,
        SYSUTCDATETIME(),
        SUSER_SNAME(),
        SYSUTCDATETIME(),
        SUSER_SNAME()
    );
