import { ConfigVersion, ConfigVersionConflict, RuleScope } from "@/core/domain/entities/ConfigVersion";

export interface IConfigVersionRepository {
  getVersion(applicationId: string, ruleScope: RuleScope): Promise<ConfigVersion | null>;

  /**
   * Atomically increment version if current matches expected.
   * Returns the new ConfigVersion on success, or null if version mismatch (conflict).
   */
  incrementVersion(
    applicationId: string,
    ruleScope: RuleScope,
    expectedVersion: number,
    actorUserId: string
  ): Promise<ConfigVersion | null>;

  /**
   * Get current version along with the current committed rules for conflict resolution.
   * Used when returning 409 Conflict responses.
   */
  getConflictState(
    applicationId: string,
    ruleScope: RuleScope
  ): Promise<ConfigVersionConflict | null>;
}
