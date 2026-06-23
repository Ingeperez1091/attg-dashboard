import {
  ConfigVersion,
  ConfigVersionConflict,
  RuleScope,
} from "@/core/domain/entities/ConfigVersion";
import { IConfigVersionRepository } from "@/core/domain/repositories/IConfigVersionRepository";

/**
 * In-memory test double for IConfigVersionRepository.
 * Simulates atomic version increment with optimistic concurrency.
 */
export class ConfigVersionMemoryRepository implements IConfigVersionRepository {
  private readonly store = new Map<string, ConfigVersion>();

  constructor() {
    // Seed default versions for the 5 MVP applications × 2 scopes
    const appIds = [
      "10000000-0000-0000-0000-000000000001",
      "10000000-0000-0000-0000-000000000002",
      "10000000-0000-0000-0000-000000000003",
      "10000000-0000-0000-0000-000000000004",
      "10000000-0000-0000-0000-000000000005",
    ];
    const scopes: RuleScope[] = ["Denominator", "Numerator"];

    for (const appId of appIds) {
      for (const scope of scopes) {
        this.store.set(this.key(appId, scope), {
          applicationId: appId,
          ruleScope: scope,
          version: 1,
          lastModifiedBy: "SYSTEM",
          lastModifiedAt: new Date().toISOString(),
        });
      }
    }
  }

  async getVersion(applicationId: string, ruleScope: RuleScope): Promise<ConfigVersion | null> {
    return this.store.get(this.key(applicationId, ruleScope)) ?? null;
  }

  async incrementVersion(
    applicationId: string,
    ruleScope: RuleScope,
    expectedVersion: number,
    actorUserId: string
  ): Promise<ConfigVersion | null> {
    const current = this.store.get(this.key(applicationId, ruleScope));
    if (!current) return null;

    // Optimistic concurrency check
    if (current.version !== expectedVersion) {
      return null; // Version mismatch — conflict
    }

    const updated: ConfigVersion = {
      ...current,
      version: current.version + 1,
      lastModifiedBy: actorUserId,
      lastModifiedAt: new Date().toISOString(),
    };
    this.store.set(this.key(applicationId, ruleScope), updated);
    return updated;
  }

  async getConflictState(
    applicationId: string,
    ruleScope: RuleScope
  ): Promise<ConfigVersionConflict | null> {
    const current = this.store.get(this.key(applicationId, ruleScope));
    if (!current) return null;

    return {
      currentVersion: current.version,
      currentRules: [], // In-memory: rules would come from filter repository
      lastModifiedBy: current.lastModifiedBy,
      lastModifiedAt: current.lastModifiedAt,
    };
  }

  private key(applicationId: string, ruleScope: RuleScope): string {
    return `${applicationId}:${ruleScope}`;
  }
}
