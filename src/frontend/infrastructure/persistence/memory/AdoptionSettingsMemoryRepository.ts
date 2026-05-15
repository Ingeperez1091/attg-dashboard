import {
  AdoptionSettings,
  AdoptionSettingsUpdateInput
} from "@/core/domain/entities/DenominatorFilter";
import { IAdoptionSettingsRepository } from "@/core/domain/repositories/IAdoptionSettingsRepository";
import { createStoreAccessor } from "@/infrastructure/persistence/memory/sharedStore";

export type StoredAdoptionAuditEntry = {
  auditId: string;
  applicationId: string;
  actorUserId: string;
  previousSettingsJson: string;
  newSettingsJson: string;
  changeScope: "Adoption";
  changedAt: string;
};

type AdoptionSettingsStore = {
  settingsByAppId: Record<string, AdoptionSettings>;
  audits: StoredAdoptionAuditEntry[];
};

const adoptionSettingsStoreAccessor = createStoreAccessor<AdoptionSettingsStore>({
  storeFilePath: process.env.TEST_FILTER_REPOSITORY_STORE_FILE,
  globalKey: "__dashboardAdoptionSettingsRepoStore",
  createEmptyStore: () => ({ settingsByAppId: {}, audits: [] })
});

export class AdoptionSettingsMemoryRepository implements IAdoptionSettingsRepository {
  async getByApplicationId(applicationId: string): Promise<AdoptionSettings | null> {
    return adoptionSettingsStoreAccessor.getStore().settingsByAppId[applicationId] ?? null;
  }

  async upsert(
    applicationId: string,
    settings: AdoptionSettingsUpdateInput,
    _actorUserId: string
  ): Promise<AdoptionSettings> {
    const store = adoptionSettingsStoreAccessor.getStore();
    const previous = store.settingsByAppId[applicationId] ?? null;
    const next: AdoptionSettings = {
      applicationId,
      adoptionLevel: settings.adoptionLevel,
      revenueMetric: settings.revenueMetric,
      numeratorSource: settings.numeratorSource,
      updatedAt: new Date().toISOString(),
      updatedBy: _actorUserId
    };

    store.settingsByAppId[applicationId] = next;
    store.audits.push({
      auditId: crypto.randomUUID(),
      applicationId,
      actorUserId: _actorUserId,
      previousSettingsJson: JSON.stringify(previous),
      newSettingsJson: JSON.stringify(next),
      changeScope: "Adoption",
      changedAt: new Date().toISOString()
    });
    adoptionSettingsStoreAccessor.writeStore(store);
    return next;
  }
}

export function getAdoptionAuditEntriesForTests(applicationId?: string): StoredAdoptionAuditEntry[] {
  const store = adoptionSettingsStoreAccessor.getStore();
  if (!applicationId) return [...store.audits];
  return store.audits.filter((entry) => entry.applicationId === applicationId);
}
