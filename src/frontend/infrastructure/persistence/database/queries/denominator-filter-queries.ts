import { executeParameterizedQuery, SqlClient } from "@/lib/db/sql-client";

export interface DenominatorFilterRuleRow {
  RuleId: string;
  ApplicationId: string;
  DenominatorModelId: string;
  FieldName: string;
  FieldType: "text" | "numeric" | "date";
  Operator: string;
  Value: string;
  RuleOrder: number;
  UpdatedBy: string;
  UpdateDate: string;
  ApplicationName: string;
}

export async function listActiveDenominatorRulesByApplication(
  client: SqlClient,
  applicationId: string
): Promise<DenominatorFilterRuleRow[]> {
  const sql = `
    SELECT
      dfr.RuleId,
      dfr.ApplicationId,
      dfr.DenominatorModelId,
      dm.FieldName,
      dm.FieldType,
      dfr.Operator,
      dfr.Value,
      dfr.RuleOrder,
      dfr.UpdatedBy,
      dfr.UpdateDate,
      a.ApplicationName
    FROM app.DenominatorFilterRules dfr
    INNER JOIN app.DenominatorModels dm ON dm.DenominatorModelId = dfr.DenominatorModelId
    INNER JOIN app.Applications a ON a.ApplicationId = dfr.ApplicationId
    WHERE dfr.ApplicationId = @applicationId
      AND dfr.IsActive = 1
      AND dm.IsActive = 1
      AND a.IsActive = 1
    ORDER BY dfr.RuleOrder ASC;
  `;

  const result = await executeParameterizedQuery<DenominatorFilterRuleRow>(client, sql, { applicationId });
  return result.rows;
}

export async function deactivateActiveDenominatorRulesByApplication(
  client: SqlClient,
  applicationId: string,
  actorUserId: string
): Promise<void> {
  await executeParameterizedQuery(client, `
    UPDATE app.DenominatorFilterRules
    SET IsActive = 0,
        UpdateDate = SYSUTCDATETIME(),
        UpdatedBy = @actorUserId
    WHERE ApplicationId = @applicationId
      AND IsActive = 1;
  `, { applicationId, actorUserId });
}

export interface InsertDenominatorFilterRuleInput {
  ruleId: string;
  applicationId: string;
  denominatorModelId: string;
  operator: string;
  value: string;
  ruleOrder: number;
  actorUserId: string;
}

export async function insertActiveDenominatorRule(
  client: SqlClient,
  input: InsertDenominatorFilterRuleInput
): Promise<void> {
  await executeParameterizedQuery(client, `
    INSERT INTO app.DenominatorFilterRules
    (RuleId, ApplicationId, DenominatorModelId, Operator, Value, RuleOrder,
     IsActive, CreateDate, CreatedBy, UpdateDate, UpdatedBy)
    VALUES
    (@ruleId, @applicationId, @denominatorModelId, @operator, @value, @ruleOrder,
     1, SYSUTCDATETIME(), @actorUserId, SYSUTCDATETIME(), @actorUserId);
  `, { ...input });
}

export interface DenominatorPreviewRuleInput {
  denominatorModelId: string;
  operator: string;
  value: string;
}

export interface DenominatorPreviewModelField {
  denominatorModelId: string;
  sourceColumn: string;
}

export interface DenominatorPreviewAggregateRow {
  Count: number;
  Revenue: number | null;
}

export interface DenominatorPreviewQuery {
  sql: string;
  params: Record<string, unknown>;
}

function toSqlOperator(operator: string): string {
  const map: Record<string, string> = {
    EQUALS: "=",
    NOT_EQUALS: "<>",
    GREATER_THAN: ">",
    GREATER_OR_EQUAL: ">=",
    LESS_THAN: "<",
    LESS_OR_EQUAL: "<="
  };

  return map[operator] ?? "=";
}

export function buildDenominatorPreviewAggregateQuery(
  rules: DenominatorPreviewRuleInput[],
  modelFields: DenominatorPreviewModelField[],
  revenueMetric: string
): DenominatorPreviewQuery {
  const params: Record<string, unknown> = {};
  const clauses: string[] = [];
  let paramIndex = 0;

  for (const rule of rules) {
    const model = modelFields.find((field) => field.denominatorModelId === rule.denominatorModelId);
    if (!model) {
      continue;
    }

    const column = model.sourceColumn;
    const operator = rule.operator;

    if (operator === "CONTAINS" || operator === "NOT_CONTAINS") {
      const name = `p${paramIndex++}`;
      params[name] = `%${rule.value}%`;
      clauses.push(`${column} ${operator === "CONTAINS" ? "LIKE" : "NOT LIKE"} @${name}`);
      continue;
    }

    if (operator === "IN_LIST" || operator === "NOT_IN_LIST") {
      const values = rule.value
        .split(";")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      if (values.length === 0) {
        continue;
      }

      const inParams: string[] = [];
      for (const value of values) {
        const name = `p${paramIndex++}`;
        params[name] = value;
        inParams.push(`@${name}`);
      }

      clauses.push(`${column} ${operator === "IN_LIST" ? "IN" : "NOT IN"} (${inParams.join(", ")})`);
      continue;
    }

    const name = `p${paramIndex++}`;
    params[name] = rule.value;
    clauses.push(`${column} ${toSqlOperator(operator)} @${name}`);
  }

  const revenueColumn = `[${revenueMetric.replace(/\[|\]/g, "")}]`;
  const whereClause = clauses.length > 0 ? clauses.join(" AND ") : "1 = 1";

  return {
    sql: `
      SELECT
        COUNT_BIG(1) AS Count,
        COALESCE(SUM(CAST(${revenueColumn} AS DECIMAL(38, 6))), 0) AS Revenue
      FROM [InventoryAnalysis].[dbo].[vw_USTaxBTS_FY26_MaxACD]
      WHERE ${whereClause};
    `,
    params
  };
}

export async function executeDenominatorPreviewAggregate(
  client: SqlClient,
  rules: DenominatorPreviewRuleInput[],
  modelFields: DenominatorPreviewModelField[],
  revenueMetric: string
): Promise<DenominatorPreviewAggregateRow> {
  const query = buildDenominatorPreviewAggregateQuery(rules, modelFields, revenueMetric);
  const result = await executeParameterizedQuery<DenominatorPreviewAggregateRow>(
    client,
    query.sql,
    query.params
  );

  return result.rows[0] ?? { Count: 0, Revenue: 0 };
}

export interface InsertDenominatorRuleChangeAuditInput {
  auditId: string;
  applicationId: string;
  actorUserId: string;
  previousRulesJson: string;
  newRulesJson: string;
}

export async function insertDenominatorRuleChangeAudit(
  client: SqlClient,
  input: InsertDenominatorRuleChangeAuditInput
): Promise<void> {
  await executeParameterizedQuery(client, `
    INSERT INTO app.RuleChangeAudit
    (AuditId, ApplicationId, ActorUserId, PreviousRulesJson, NewRulesJson, ChangeScope, ChangedAt)
    VALUES
    (@auditId, @applicationId, @actorUserId, @previousRulesJson, @newRulesJson, 'Denominator', SYSUTCDATETIME());
  `, { ...input });
}
