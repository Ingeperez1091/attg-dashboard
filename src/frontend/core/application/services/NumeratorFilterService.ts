import {
  NumeratorFilterRuleset,
  NumeratorModelField,
  UpdateNumeratorFilterRuleInput
} from "@/core/domain/entities/NumeratorFilter";
import { INumeratorFilterRepository } from "@/core/domain/repositories/INumeratorFilterRepository";
import { AppError } from "@/lib/api/error-handler";
import { FilterRule } from "@/core/domain/value-objects/FilterRule";

export class NumeratorFilterService {
  constructor(private readonly repository: INumeratorFilterRepository) {}

  async getFiltersByApplicationId(applicationId: string): Promise<NumeratorFilterRuleset> {
    const ruleset = await this.repository.getByApplicationId(applicationId);
    if (!ruleset) {
      throw new AppError(404, "NOT_FOUND", "Application not found");
    }

    return ruleset;
  }

  async getModelByApplicationId(applicationId: string): Promise<NumeratorModelField[]> {
    return this.repository.getModelByApplicationId(applicationId);
  }

  async updateFilters(
    applicationId: string,
    actorUserId: string,
    rules: UpdateNumeratorFilterRuleInput[]
  ): Promise<NumeratorFilterRuleset> {
    const modelFields = await this.repository.getModelByApplicationId(applicationId);

    const validatedRules = rules.map((rule, index) => {
      const field = this.resolveFilterableField(modelFields, rule.applicationModelFieldId);
      const valueObject = new FilterRule({
        applicationModelFieldId: rule.applicationModelFieldId,
        operator: rule.operator,
        value: rule.value,
        ruleOrder: index + 1
      });
      valueObject.validate(field.fieldType);
      return rule;
    });

    return this.repository.updateRules({
      applicationId,
      actorUserId,
      rules: validatedRules
    });
  }

  private resolveFilterableField(fields: NumeratorModelField[], fieldId: string): NumeratorModelField {
    const field = fields.find((item) => item.applicationModelFieldId === fieldId);
    if (!field) {
      throw new AppError(400, "VALIDATION_ERROR", "Field ID not found for this application.");
    }

    if (!field.isFilterable) {
      throw new AppError(400, "FIELD_NOT_FILTERABLE", `Field '${field.fieldName}' is not marked as filterable.`);
    }

    return field;
  }
}
