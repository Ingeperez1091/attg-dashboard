import { DenominatorAuditHistoryEntry } from "@/core/domain/entities/DenominatorFilter";
import { IDenominatorAuditRepository } from "@/core/domain/repositories/IDenominatorAuditRepository";
import { getAdoptionAuditEntriesForTests } from "@/infrastructure/persistence/memory/AdoptionSettingsMemoryRepository";
import { getDenominatorAuditEntriesForTests } from "@/infrastructure/persistence/memory/DenominatorFilterMemoryRepository";

export class DenominatorAuditMemoryRepository implements IDenominatorAuditRepository {
  async listByApplicationId(applicationId: string): Promise<DenominatorAuditHistoryEntry[]> {
    const denominator = getDenominatorAuditEntriesForTests(applicationId).map((entry) => ({
      auditId: entry.auditId,
      applicationId: entry.applicationId,
      actorUserId: entry.actorUserId,
      changeScope: entry.changeScope,
      previousRulesJson: entry.previousRulesJson,
      newRulesJson: entry.newRulesJson,
      changedAt: entry.changedAt
    }));

    const adoption = getAdoptionAuditEntriesForTests(applicationId).map((entry) => ({
      auditId: entry.auditId,
      applicationId: entry.applicationId,
      actorUserId: entry.actorUserId,
      changeScope: entry.changeScope,
      previousRulesJson: entry.previousSettingsJson,
      newRulesJson: entry.newSettingsJson,
      changedAt: entry.changedAt
    }));

    return [...denominator, ...adoption].sort((a, b) => Date.parse(b.changedAt) - Date.parse(a.changedAt));
  }
}
