import {
  AdoptionSettings,
  AdoptionSettingsUpdateInput
} from "@/core/domain/entities/DenominatorFilter";

export interface IAdoptionSettingsRepository {
  getByApplicationId(applicationId: string): Promise<AdoptionSettings | null>;
  upsert(
    applicationId: string,
    settings: AdoptionSettingsUpdateInput,
    actorUserId: string
  ): Promise<AdoptionSettings>;
}
