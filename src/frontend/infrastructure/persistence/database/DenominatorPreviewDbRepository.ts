import { SqlClient } from "@/lib/db/sql-client";
import {
  IDenominatorPreviewRepository,
  DenominatorPreviewRuleInput
} from "@/core/domain/repositories/IDenominatorPreviewRepository";

/**
 * Azure SQL Database implementation of IDenominatorPreviewRepository.
 * Stages preview rules into stage.DenominatorFilterRulesPreview with
 * parameterized SQL for safe insertion and cleanup.
 */
export class DenominatorPreviewDbRepository implements IDenominatorPreviewRepository {
  constructor(private readonly sqlClient: SqlClient) {}

  async stageRules(
    sessionId: string,
    applicationId: string,
    rules: DenominatorPreviewRuleInput[]
  ): Promise<void> {
    if (rules.length === 0) return;

    // Build a parameterized multi-row INSERT using numbered parameters.
    // Each rule becomes a row with its own set of params to prevent injection.
    const valuePlaceholders: string[] = [];
    const params: Record<string, unknown> = {
      sessionId,
      applicationId
    };

    for (let i = 0; i < rules.length; i++) {
      valuePlaceholders.push(
        `(NEWID(), @sessionId, @applicationId, @denominatorModelId${i}, @operator${i}, @value${i}, @ruleOrder${i}, SYSUTCDATETIME(), DATEADD(HOUR, 1, SYSUTCDATETIME()))`
      );
      params[`denominatorModelId${i}`] = rules[i].denominatorModelId;
      params[`operator${i}`] = rules[i].operator;
      params[`value${i}`] = rules[i].value;
      params[`ruleOrder${i}`] = i + 1;
    }

    const sql = `
      INSERT INTO stage.DenominatorFilterRulesPreview
        (PreviewId, SessionId, ApplicationId, DenominatorModelId, Operator, Value, RuleOrder, CreateDate, ExpiresAt)
      VALUES
        ${valuePlaceholders.join(",\n        ")};
    `;

    await this.sqlClient.query(sql, params);
  }

  async deleteBySessionId(sessionId: string): Promise<void> {
    await this.sqlClient.query(
      `DELETE FROM stage.DenominatorFilterRulesPreview WHERE SessionId = @sessionId;`,
      { sessionId }
    );
  }
}
