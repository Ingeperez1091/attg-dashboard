import { executeParameterizedQuery, SqlClient } from "@/lib/db/sql-client";

export interface NumeratorFilterRuleRow {
  RuleId: string;
  ApplicationId: string;
  ApplicationModelFieldId: string;
  FieldName: string;
  FieldType: "text" | "numeric" | "boolean" | "date";
  Operator: string;
  Value: string;
  RuleOrder: number;
  CreatedBy: string;
  UpdatedBy: string;
  UpdateDate: string;
  ApplicationName: string;
}

export interface NumeratorModelFieldRow {
  ApplicationModelFieldId: string;
  ApplicationId: string;
  FieldName: string;
  FieldType: "text" | "numeric" | "boolean" | "date";
  IsFilterable: boolean | number;
  IsMetricDimension: boolean | number;
  DisplayOrder: number;
}

export async function listActiveRulesByApplication(
  client: SqlClient,
  applicationId: string
): Promise<NumeratorFilterRuleRow[]> {
  const sql = `
    SELECT
      nfr.RuleId,
      nfr.ApplicationId,
      nfr.ApplicationModelFieldId,
      amf.FieldName,
      amf.FieldType,
      nfr.Operator,
      nfr.Value,
      nfr.RuleOrder,
      nfr.CreatedBy,
      nfr.UpdatedBy,
      nfr.UpdateDate,
      a.ApplicationName
    FROM app.NumeratorFilterRules nfr
    INNER JOIN app.ApplicationModelFields amf ON amf.ApplicationModelFieldId = nfr.ApplicationModelFieldId
    INNER JOIN app.Applications a ON a.ApplicationId = nfr.ApplicationId
    WHERE nfr.ApplicationId = @applicationId
      AND nfr.IsActive = 1
      AND amf.IsActive = 1
      AND a.IsActive = 1
    ORDER BY nfr.RuleOrder ASC;
  `;

  const result = await executeParameterizedQuery<NumeratorFilterRuleRow>(client, sql, { applicationId });
  return result.rows;
}

export async function listActiveModelFieldsByApplication(
  client: SqlClient,
  applicationId: string
): Promise<NumeratorModelFieldRow[]> {
  const sql = `
    SELECT
      ApplicationModelFieldId,
      ApplicationId,
      FieldName,
      FieldType,
      IsFilterable,
      IsMetricDimension,
      DisplayOrder
    FROM app.ApplicationModelFields
    WHERE ApplicationId = @applicationId
      AND IsActive = 1
    ORDER BY DisplayOrder ASC, ApplicationModelFieldId ASC;
  `;

  const result = await executeParameterizedQuery<NumeratorModelFieldRow>(client, sql, { applicationId });
  return result.rows;
}

export async function deactivateActiveRulesByApplication(
  client: SqlClient,
  applicationId: string,
  actorUserId: string
): Promise<void> {
  await executeParameterizedQuery(client, `
    UPDATE app.NumeratorFilterRules
    SET IsActive = 0,
        UpdateDate = SYSUTCDATETIME(),
        UpdatedBy = @actorUserId
    WHERE ApplicationId = @applicationId
      AND IsActive = 1;
  `, { applicationId, actorUserId });
}

export interface InsertNumeratorFilterRuleInput {
  ruleId: string;
  applicationId: string;
  applicationModelFieldId: string;
  operator: string;
  value: string;
  ruleOrder: number;
  actorUserId: string;
}

export async function insertActiveRule(
  client: SqlClient,
  input: InsertNumeratorFilterRuleInput
): Promise<void> {
  const params: Record<string, unknown> = { ...input };
  await executeParameterizedQuery(client, `
    INSERT INTO app.NumeratorFilterRules
    (RuleId, ApplicationId, ApplicationModelFieldId, Operator, Value, RuleOrder,
     IsActive, CreateDate, CreatedBy, UpdateDate, UpdatedBy)
    VALUES
    (@ruleId, @applicationId, @applicationModelFieldId, @operator, @value, @ruleOrder,
     1, SYSUTCDATETIME(), @actorUserId, SYSUTCDATETIME(), @actorUserId);
  `, params);
}

export interface InsertRuleChangeAuditInput {
  auditId: string;
  applicationId: string;
  actorUserId: string;
  previousRulesJson: string;
  newRulesJson: string;
}

export async function insertRuleChangeAudit(
  client: SqlClient,
  input: InsertRuleChangeAuditInput
): Promise<void> {
  const params: Record<string, unknown> = { ...input };
  await executeParameterizedQuery(client, `
    INSERT INTO app.RuleChangeAudit
    (AuditId, ApplicationId, ActorUserId, PreviousRulesJson, NewRulesJson, ChangedAt)
    VALUES
    (@auditId, @applicationId, @actorUserId, @previousRulesJson, @newRulesJson, SYSUTCDATETIME());
  `, params);
}
