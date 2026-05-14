import {
  DenominatorImpactSnapshot,
  DenominatorModelField,
  DenominatorFilterRuleset,
  UpdateDenominatorFilterRuleInput,
  UpdateDenominatorFiltersInput
} from "@/core/domain/entities/DenominatorFilter";

export interface IDenominatorFilterRepository {
  getByApplicationId(applicationId: string): Promise<DenominatorFilterRuleset | null>;
  updateRules(input: UpdateDenominatorFiltersInput): Promise<DenominatorFilterRuleset>;
  previewImpact(
    applicationId: string,
    rules: UpdateDenominatorFilterRuleInput[],
    modelFields: DenominatorModelField[],
    revenueMetric: string
  ): Promise<DenominatorImpactSnapshot>;
}
