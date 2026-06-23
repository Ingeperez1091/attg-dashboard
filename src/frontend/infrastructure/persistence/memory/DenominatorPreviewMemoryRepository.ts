import {
  DenominatorPreviewRuleInput,
  DenominatorPreviewRule,
  IDenominatorPreviewRepository,
} from "@/core/domain/repositories/IDenominatorPreviewRepository";
import { randomUUID } from "node:crypto";

/**
 * In-memory test double for IDenominatorPreviewRepository.
 * Stores staged rules in a Map keyed by sessionId.
 */
export class DenominatorPreviewMemoryRepository implements IDenominatorPreviewRepository {
  private readonly store = new Map<string, DenominatorPreviewRule[]>();

  async stageRules(
    sessionId: string,
    applicationId: string,
    rules: DenominatorPreviewRuleInput[]
  ): Promise<void> {
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const staged: DenominatorPreviewRule[] = rules.map((rule, index) => ({
      previewId: randomUUID(),
      sessionId,
      applicationId,
      denominatorModelId: rule.denominatorModelId,
      operator: rule.operator,
      value: rule.value,
      ruleOrder: index + 1,
      createDate: now,
      expiresAt,
    }));

    this.store.set(sessionId, staged);
  }

  async deleteBySessionId(sessionId: string): Promise<void> {
    this.store.delete(sessionId);
  }

  // Test helper: get staged rules for assertions
  getStagedRules(sessionId: string): DenominatorPreviewRule[] | undefined {
    return this.store.get(sessionId);
  }

  // Test helper: check if any rules exist
  hasRules(sessionId: string): boolean {
    return this.store.has(sessionId);
  }
}
