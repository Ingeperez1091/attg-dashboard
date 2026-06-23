import { SqlClient } from "@/lib/db/sql-client";
import { ConfigVersion, ConfigVersionConflict, RuleScope } from "@/core/domain/entities/ConfigVersion";
import { IConfigVersionRepository } from "@/core/domain/repositories/IConfigVersionRepository";

/**
 * Azure SQL Database implementation of IConfigVersionRepository.
 * Uses atomic UPDATE WHERE Version=@expected for optimistic concurrency.
 */
export class ConfigVersionDbRepository implements IConfigVersionRepository {
  constructor(private readonly sqlClient: SqlClient) {}

  async getVersion(applicationId: string, ruleScope: RuleScope): Promise<ConfigVersion | null> {
    const result = await this.sqlClient.query<ConfigVersion>(
      `SELECT
        ApplicationId AS applicationId,
        RuleScope AS ruleScope,
        Version AS version,
        LastModifiedBy AS lastModifiedBy,
        LastModifiedAt AS lastModifiedAt
      FROM app.ConfigVersions
      WHERE ApplicationId = @applicationId
        AND RuleScope = @ruleScope;`,
      { applicationId, ruleScope }
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async incrementVersion(
    applicationId: string,
    ruleScope: RuleScope,
    expectedVersion: number,
    actorUserId: string
  ): Promise<ConfigVersion | null> {
    // Atomic conditional UPDATE — only succeeds if Version matches expected.
    // Returns the new row via OUTPUT clause for single-roundtrip.
    const result = await this.sqlClient.query<ConfigVersion>(
      `UPDATE app.ConfigVersions
      SET Version = Version + 1,
          LastModifiedBy = @actorUserId,
          LastModifiedAt = SYSUTCDATETIME()
      OUTPUT
        inserted.ApplicationId AS applicationId,
        inserted.RuleScope AS ruleScope,
        inserted.Version AS version,
        inserted.LastModifiedBy AS lastModifiedBy,
        inserted.LastModifiedAt AS lastModifiedAt
      WHERE ApplicationId = @applicationId
        AND RuleScope = @ruleScope
        AND Version = @expectedVersion;`,
      { applicationId, ruleScope, expectedVersion, actorUserId }
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async getConflictState(
    applicationId: string,
    ruleScope: RuleScope
  ): Promise<ConfigVersionConflict | null> {
    const version = await this.getVersion(applicationId, ruleScope);
    if (!version) return null;

    // Load current committed rules for the conflict resolution payload
    const rulesTable = ruleScope === "Denominator"
      ? "app.DenominatorFilterRules"
      : "app.NumeratorFilterRules";

    const rulesResult = await this.sqlClient.query<Record<string, unknown>>(
      `SELECT * FROM ${rulesTable}
       WHERE ApplicationId = @applicationId AND IsActive = 1
       ORDER BY RuleOrder;`,
      { applicationId }
    );

    return {
      currentVersion: version.version,
      currentRules: rulesResult.rows,
      lastModifiedBy: version.lastModifiedBy,
      lastModifiedAt: version.lastModifiedAt,
    };
  }
}
