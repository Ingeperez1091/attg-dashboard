import { executeParameterizedQuery, SqlClient } from "@/lib/db/sql-client";

export interface AdoptionSettingsRow {
  ApplicationId: string;
  AdoptionLevel: "Engagement" | "Client";
  RevenueMetric: string;
  NumeratorSource: "API" | "Manual";
  UpdatedBy: string;
  UpdateDate: string;
}

export async function getAdoptionSettingsByApplicationId(
  client: SqlClient,
  applicationId: string
): Promise<AdoptionSettingsRow | null> {
  const sql = `
    SELECT
      ApplicationId,
      AdoptionLevel,
      RevenueMetric,
      NumeratorSource,
      UpdatedBy,
      UpdateDate
    FROM app.AdoptionSettings
    WHERE ApplicationId = @applicationId;
  `;

  const result = await executeParameterizedQuery<AdoptionSettingsRow>(client, sql, { applicationId });
  return result.rows[0] ?? null;
}

export interface UpsertAdoptionSettingsInput {
  settingId: string;
  applicationId: string;
  adoptionLevel: "Engagement" | "Client";
  revenueMetric: string;
  numeratorSource: "API" | "Manual";
  actorUserId: string;
}

export async function upsertAdoptionSettings(
  client: SqlClient,
  input: UpsertAdoptionSettingsInput
): Promise<AdoptionSettingsRow> {
  const sql = `
    MERGE app.AdoptionSettings AS target
    USING (VALUES (@applicationId, @adoptionLevel, @revenueMetric, @numeratorSource)) AS source (ApplicationId, AdoptionLevel, RevenueMetric, NumeratorSource)
    ON target.ApplicationId = source.ApplicationId
    WHEN MATCHED THEN
      UPDATE SET
        target.AdoptionLevel = source.AdoptionLevel,
        target.RevenueMetric = source.RevenueMetric,
        target.NumeratorSource = source.NumeratorSource,
        target.UpdateDate = SYSUTCDATETIME(),
        target.UpdatedBy = @actorUserId
    WHEN NOT MATCHED THEN
      INSERT (SettingId, ApplicationId, AdoptionLevel, RevenueMetric, NumeratorSource, CreateDate, CreatedBy, UpdateDate, UpdatedBy)
      VALUES (@settingId, source.ApplicationId, source.AdoptionLevel, source.RevenueMetric, source.NumeratorSource, SYSUTCDATETIME(), @actorUserId, SYSUTCDATETIME(), @actorUserId);
  `;

  await executeParameterizedQuery(client, sql, {
    settingId: input.settingId,
    applicationId: input.applicationId,
    adoptionLevel: input.adoptionLevel,
    revenueMetric: input.revenueMetric,
    numeratorSource: input.numeratorSource,
    actorUserId: input.actorUserId
  });

  const row = await getAdoptionSettingsByApplicationId(client, input.applicationId);
  if (!row) {
    throw new Error("Adoption settings upsert failed: row not found after merge.");
  }

  return row;
}

export interface InsertAdoptionRuleChangeAuditInput {
  auditId: string;
  applicationId: string;
  actorUserId: string;
  previousSettingsJson: string;
  newSettingsJson: string;
}

export async function insertAdoptionRuleChangeAudit(
  client: SqlClient,
  input: InsertAdoptionRuleChangeAuditInput
): Promise<void> {
  await executeParameterizedQuery(client, `
    INSERT INTO app.RuleChangeAudit
    (AuditId, ApplicationId, ActorUserId, PreviousRulesJson, NewRulesJson, ChangeScope, ChangedAt)
    VALUES
    (@auditId, @applicationId, @actorUserId, @previousSettingsJson, @newSettingsJson, 'Adoption', SYSUTCDATETIME());
  `, { ...input });
}

