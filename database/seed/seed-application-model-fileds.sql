SET NOCOUNT ON;

MERGE app.ApplicationModelFields AS target
USING (
    VALUES
        ('40000000-0000-0000-0101-000000000001','10000000-0000-0000-0000-000000000001','EngagementId','text','$.engagementId',0,0,1),
        ('40000000-0000-0000-0102-000000000001','10000000-0000-0000-0000-000000000001','ClientId','text','$.clientId',1,0,2),
        ('40000000-0000-0000-0103-000000000001','10000000-0000-0000-0000-000000000001','ClientName','text','$.clientName',0,0,3),
        ('40000000-0000-0000-0104-000000000001','10000000-0000-0000-0000-000000000001','EngagementName','text','$.engagementName',0,0,4),
        ('40000000-0000-0000-0105-000000000001','10000000-0000-0000-0000-000000000001','InMaestro','boolean','$.inMaestro',1,1,5),

        ('40000000-0000-0000-0201-000000000002','10000000-0000-0000-0000-000000000002','ClientId','text','$.clientId',0,0,1),
        ('40000000-0000-0000-0202-000000000002','10000000-0000-0000-0000-000000000002','ClientName','text','$.clientName',0,0,2),
        ('40000000-0000-0000-0203-000000000002','10000000-0000-0000-0000-000000000002','EngagementCount','numeric','$.engagementCount',1,0,3),
        ('40000000-0000-0000-0204-000000000002','10000000-0000-0000-0000-000000000002','TotalRevenueETD','numeric','$.totalRevenueETD',1,1,4),
        ('40000000-0000-0000-0205-000000000002','10000000-0000-0000-0000-000000000002','EYSTActive','text','$.eystActive',1,0,5),
        ('40000000-0000-0000-0206-000000000002','10000000-0000-0000-0000-000000000002','EYSTDataCleanupActive','text','$.eystDataCleanupActive',1,0,6),
        ('40000000-0000-0000-0207-000000000002','10000000-0000-0000-0000-000000000002','Notes','text','$.notes',0,0,7),

        ('40000000-0000-0000-0301-000000000003','10000000-0000-0000-0000-000000000003','ClientId','text','$.clientId',0,0,1),
        ('40000000-0000-0000-0302-000000000003','10000000-0000-0000-0000-000000000003','ClientName','text','$.clientName',0,0,2),
        ('40000000-0000-0000-0303-000000000003','10000000-0000-0000-0000-000000000003','EngagementCount','numeric','$.engagementCount',1,0,3),
        ('40000000-0000-0000-0304-000000000003','10000000-0000-0000-0000-000000000003','TotalRevenueFYTD','numeric','$.totalRevenueFYTD',1,1,4),
        ('40000000-0000-0000-0305-000000000003','10000000-0000-0000-0000-000000000003','InProdigy','text','$.inProdigy',0,0,5),
        ('40000000-0000-0000-0306-000000000003','10000000-0000-0000-0000-000000000003','Override','text','$.override',1,0,6),
        ('40000000-0000-0000-0307-000000000003','10000000-0000-0000-0000-000000000003','Notes','text','$.notes',0,0,7),

        ('40000000-0000-0000-0401-000000000004','10000000-0000-0000-0000-000000000004','EngagementId','text','$.engagementId',0,0,1),
        ('40000000-0000-0000-0402-000000000004','10000000-0000-0000-0000-000000000004','ClientId','text','$.clientId',1,0,2),
        ('40000000-0000-0000-0403-000000000004','10000000-0000-0000-0000-000000000004','ClientName','text','$.clientName',0,0,3),
        ('40000000-0000-0000-0404-000000000004','10000000-0000-0000-0000-000000000004','RevenueFYTD','numeric','$.revenueFYTD',1,0,4),
        ('40000000-0000-0000-0405-000000000004','10000000-0000-0000-0000-000000000004','RevenueETD','numeric','$.revenueETD',1,1,5),
        ('40000000-0000-0000-0406-000000000004','10000000-0000-0000-0000-000000000004','VectorEngagement','text','$.vectorEngagement',1,0,6),

        ('40000000-0000-0000-0501-000000000005','10000000-0000-0000-0000-000000000005','EngagementId','text','$.engagementId',0,0,1),
        ('40000000-0000-0000-0502-000000000005','10000000-0000-0000-0000-000000000005','ClientId','text','$.clientId',0,0,2),
        ('40000000-0000-0000-0503-000000000005','10000000-0000-0000-0000-000000000005','ClientName','text','$.clientName',0,0,3),
        ('40000000-0000-0000-0504-000000000005','10000000-0000-0000-0000-000000000005','EngagementName','text','$.engagementName',0,0,4),
        ('40000000-0000-0000-0505-000000000005','10000000-0000-0000-0000-000000000005','RevenueFYTD','numeric','$.revenueFYTD',1,1,5),
        ('40000000-0000-0000-0506-000000000005','10000000-0000-0000-0000-000000000005','NavigateStatus','text','$.navigateStatus',1,0,6),
        ('40000000-0000-0000-0507-000000000005','10000000-0000-0000-0000-000000000005','Notes','text','$.notes',0,0,7)
) AS source (
    ApplicationModelFieldId,
    ApplicationId,
    FieldName,
    FieldType,
    SourcePath,
    IsFilterable,
    IsMetricDimension,
    DisplayOrder
)
ON target.ApplicationModelFieldId = source.ApplicationModelFieldId
WHEN MATCHED THEN
    UPDATE SET
        target.ApplicationId = source.ApplicationId,
        target.FieldName = source.FieldName,
        target.FieldType = source.FieldType,
        target.SourcePath = source.SourcePath,
        target.IsActive = 1,
        target.IsFilterable = source.IsFilterable,
        target.IsMetricDimension = source.IsMetricDimension,
        target.DisplayOrder = source.DisplayOrder,
        target.UpdateDate = SYSUTCDATETIME(),
        target.UpdatedBy = SUSER_SNAME()
WHEN NOT MATCHED THEN
    INSERT (
        ApplicationModelFieldId,
        ApplicationId,
        FieldName,
        FieldType,
        SourcePath,
        IsActive,
        IsFilterable,
        IsMetricDimension,
        DisplayOrder,
        CreateDate,
        CreatedBy,
        UpdateDate,
        UpdatedBy
    )
    VALUES (
        source.ApplicationModelFieldId,
        source.ApplicationId,
        source.FieldName,
        source.FieldType,
        source.SourcePath,
        1,
        source.IsFilterable,
        source.IsMetricDimension,
        source.DisplayOrder,
        SYSUTCDATETIME(),
        SUSER_SNAME(),
        SYSUTCDATETIME(),
        SUSER_SNAME()
    );