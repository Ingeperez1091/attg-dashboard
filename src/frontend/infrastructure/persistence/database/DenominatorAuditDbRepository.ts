import { DenominatorAuditHistoryEntry } from "@/core/domain/entities/DenominatorFilter";
import { IDenominatorAuditRepository } from "@/core/domain/repositories/IDenominatorAuditRepository";
import { listDenominatorAuditHistoryByApplication } from "@/infrastructure/persistence/database/queries/denominator-audit-queries";
import { SqlClient } from "@/lib/db/sql-client";

export class DenominatorAuditDbRepository implements IDenominatorAuditRepository {
  constructor(private readonly sqlClient: SqlClient) {}

  async listByApplicationId(applicationId: string): Promise<DenominatorAuditHistoryEntry[]> {
    const rows = await listDenominatorAuditHistoryByApplication(this.sqlClient, applicationId);

    return rows.map((row) => ({
      auditId: row.AuditId,
      applicationId: row.ApplicationId,
      actorUserId: row.ActorUserId,
      changeScope: row.ChangeScope,
      previousRulesJson: row.PreviousRulesJson,
      newRulesJson: row.NewRulesJson,
      changedAt: row.ChangedAt
    }));
  }
}
