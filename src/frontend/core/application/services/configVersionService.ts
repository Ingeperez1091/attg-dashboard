import { ConfigVersion, ConfigVersionConflict, RuleScope } from "@/core/domain/entities/ConfigVersion";
import { IConfigVersionRepository } from "@/core/domain/repositories/IConfigVersionRepository";

export interface VersionCheckResult {
  success: boolean;
  newVersion?: ConfigVersion;
  conflict?: ConfigVersionConflict | null;
}

export class ConfigVersionService {
  constructor(private readonly repository: IConfigVersionRepository) {}

  async checkAndIncrement(
    applicationId: string,
    ruleScope: RuleScope,
    expectedVersion: number,
    actorUserId: string
  ): Promise<VersionCheckResult> {
    const updated = await this.repository.incrementVersion(
      applicationId,
      ruleScope,
      expectedVersion,
      actorUserId
    );

    if (updated) {
      return { success: true, newVersion: updated };
    }

    // Version mismatch — build conflict state
    const conflict = await this.repository.getConflictState(applicationId, ruleScope);
    return { success: false, conflict: conflict ?? null };
  }

  async forceIncrement(
    applicationId: string,
    ruleScope: RuleScope,
    actorUserId: string
  ): Promise<ConfigVersion | null> {
    const current = await this.repository.getVersion(applicationId, ruleScope);
    if (!current) return null;

    // Force bypasses version check — always uses current version as expected
    return this.repository.incrementVersion(
      applicationId,
      ruleScope,
      current.version,
      actorUserId
    );
  }

  async getVersion(
    applicationId: string,
    ruleScope: RuleScope
  ): Promise<ConfigVersion | null> {
    return this.repository.getVersion(applicationId, ruleScope);
  }

  async getConflictState(
    applicationId: string,
    ruleScope: RuleScope
  ): Promise<ConfigVersionConflict | null> {
    return this.repository.getConflictState(applicationId, ruleScope);
  }
}
