import { DenominatorAuditHistoryEntry } from "@/core/domain/entities/DenominatorFilter";

export interface IDenominatorAuditRepository {
  listByApplicationId(applicationId: string): Promise<DenominatorAuditHistoryEntry[]>;
}
