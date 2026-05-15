import {
  AdoptionSettings,
  AdoptionSettingsUpdateInput
} from "@/core/domain/entities/DenominatorFilter";
import { IAdoptionSettingsRepository } from "@/core/domain/repositories/IAdoptionSettingsRepository";
import {
  getAdoptionSettingsByApplicationId,
  insertAdoptionRuleChangeAudit,
  upsertAdoptionSettings
} from "@/infrastructure/persistence/database/queries/adoption-settings-queries";
import { SqlClient } from "@/lib/db/sql-client";

export class AdoptionSettingsDbRepository implements IAdoptionSettingsRepository {
  constructor(private readonly sqlClient: SqlClient) {}

  async getByApplicationId(applicationId: string): Promise<AdoptionSettings | null> {
    const row = await getAdoptionSettingsByApplicationId(this.sqlClient, applicationId);
    if (!row) {
      return null;
    }

    return {
      applicationId: row.ApplicationId,
      adoptionLevel: row.AdoptionLevel,
      revenueMetric: row.RevenueMetric,
      numeratorSource: row.NumeratorSource,
      updatedAt: row.UpdateDate,
      updatedBy: row.UpdatedBy
    };
  }

  async upsert(
    applicationId: string,
    settings: AdoptionSettingsUpdateInput,
    actorUserId: string
  ): Promise<AdoptionSettings> {
    const previous = await this.getByApplicationId(applicationId);

    const row = await upsertAdoptionSettings(this.sqlClient, {
      settingId: crypto.randomUUID(),
      applicationId,
      adoptionLevel: settings.adoptionLevel,
      revenueMetric: settings.revenueMetric,
      numeratorSource: settings.numeratorSource,
      actorUserId
    });

    const next: AdoptionSettings = {
      applicationId: row.ApplicationId,
      adoptionLevel: row.AdoptionLevel,
      revenueMetric: row.RevenueMetric,
      numeratorSource: row.NumeratorSource,
      updatedAt: row.UpdateDate,
      updatedBy: row.UpdatedBy
    };

    await insertAdoptionRuleChangeAudit(this.sqlClient, {
      auditId: crypto.randomUUID(),
      applicationId,
      actorUserId,
      previousSettingsJson: JSON.stringify(previous),
      newSettingsJson: JSON.stringify(next)
    });

    return next;
  }
}

