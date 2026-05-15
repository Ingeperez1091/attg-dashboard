import { executeParameterizedQuery, SqlClient } from "@/lib/db/sql-client";

export interface DenominatorAuditHistoryRow {
  AuditId: string;
  ApplicationId: string;
  ActorUserId: string;
  ChangeScope: "Denominator" | "Adoption";
  PreviousRulesJson: string | null;
  NewRulesJson: string;
  ChangedAt: string;
}

export async function listDenominatorAuditHistoryByApplication(
  client: SqlClient,
  applicationId: string
): Promise<DenominatorAuditHistoryRow[]> {
  const sql = `
    SELECT
      AuditId,
      ApplicationId,
      ActorUserId,
      ChangeScope,
      PreviousRulesJson,
      NewRulesJson,
      ChangedAt
    FROM app.RuleChangeAudit
    WHERE ApplicationId = @applicationId
      AND ChangeScope IN ('Denominator', 'Adoption')
    ORDER BY ChangedAt DESC;
  `;

  const result = await executeParameterizedQuery<DenominatorAuditHistoryRow>(client, sql, { applicationId });
  return result.rows;
}
