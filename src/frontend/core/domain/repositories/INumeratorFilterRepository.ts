import {
  NumeratorFilterRuleset,
  NumeratorModelField,
  UpdateNumeratorFiltersInput
} from "@/core/domain/entities/NumeratorFilter";

export interface INumeratorFilterRepository {
  getByApplicationId(applicationId: string): Promise<NumeratorFilterRuleset | null>;
  getModelByApplicationId(applicationId: string): Promise<NumeratorModelField[]>;
  updateRules(input: UpdateNumeratorFiltersInput): Promise<NumeratorFilterRuleset>;
}
