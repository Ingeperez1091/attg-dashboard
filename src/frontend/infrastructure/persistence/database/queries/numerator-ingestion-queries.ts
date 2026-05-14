import { executeParameterizedQuery, SqlClient } from "@/lib/db/sql-client";

export interface StageRow {
  StageId: string;
  ApplicationId: string;
  PayloadJson: string;
  CreatedBy: string;
  CreateDate: string | Date;
}

export interface InsertStagedPayloadInput {
  stageId: string;
  applicationId: string;
  payloadJson: string;
  createdBy: string;
}

export async function insertStagedPayload(
  client: SqlClient,
  input: InsertStagedPayloadInput
): Promise<StageRow | null> {
  const params: Record<string, unknown> = { ...input };

  const sql = `
    DECLARE @Inserted TABLE (
      StageId UNIQUEIDENTIFIER,
      ApplicationId UNIQUEIDENTIFIER,
      PayloadJson NVARCHAR(MAX),
      CreatedBy NVARCHAR(255),
      CreateDate DATETIME2
    );

    INSERT INTO stage.EngagementUsageRaw (StageId, ApplicationId, PayloadJson, CreateDate, CreatedBy)
    OUTPUT inserted.StageId, inserted.ApplicationId, inserted.PayloadJson, inserted.CreatedBy, inserted.CreateDate
    INTO @Inserted (StageId, ApplicationId, PayloadJson, CreatedBy, CreateDate)
    VALUES (@stageId, @applicationId, @payloadJson, SYSUTCDATETIME(), @createdBy);

    SELECT StageId, ApplicationId, PayloadJson, CreatedBy, CreateDate
    FROM @Inserted;
  `;

  const result = await executeParameterizedQuery<StageRow>(client, sql, params);
  return result.rows[0] ?? null;
}
