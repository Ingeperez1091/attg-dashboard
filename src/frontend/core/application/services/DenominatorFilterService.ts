import {
  AdoptionSettings,
  AdoptionSettingsUpdateInput,
  DenominatorPreviewResult,
  DenominatorFilterRuleset,
  DenominatorModelField,
  UpdateDenominatorFilterRuleInput
} from "@/core/domain/entities/DenominatorFilter";
import { IAdoptionSettingsRepository } from "@/core/domain/repositories/IAdoptionSettingsRepository";
import { IDenominatorAuditRepository } from "@/core/domain/repositories/IDenominatorAuditRepository";
import { IDenominatorFilterRepository } from "@/core/domain/repositories/IDenominatorFilterRepository";
import { IDenominatorModelRepository } from "@/core/domain/repositories/IDenominatorModelRepository";
import { AppError } from "@/lib/api/error-handler";
import { FieldOperator } from "@/core/domain/value-objects/FieldOperator";

export class DenominatorFilterService {
    private static isSqlDateLiteral(value: string): boolean {
      return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
    }

  constructor(
    private readonly denominatorFilterRepository: IDenominatorFilterRepository,
    private readonly denominatorModelRepository: IDenominatorModelRepository,
    private readonly adoptionSettingsRepository?: IAdoptionSettingsRepository,
    private readonly denominatorAuditRepository?: IDenominatorAuditRepository
  ) {}

  async getRulesByApplicationId(applicationId: string): Promise<DenominatorFilterRuleset> {
    const ruleset = await this.denominatorFilterRepository.getByApplicationId(applicationId);
    if (!ruleset) {
      throw new AppError(404, "NOT_FOUND", "Application not found");
    }

    return ruleset;
  }

  async getModelFields(): Promise<DenominatorModelField[]> {
    return this.denominatorModelRepository.getFields();
  }

  async updateRules(
    applicationId: string,
    actorUserId: string,
    rules: UpdateDenominatorFilterRuleInput[]
  ): Promise<DenominatorFilterRuleset> {
    const modelFields = await this.denominatorModelRepository.getFields();
    const validatedRules = this.validateAndNormalizeRules(modelFields, rules);

    return this.denominatorFilterRepository.updateRules({
      applicationId,
      actorUserId,
      rules: validatedRules
    });
  }

  async previewRules(
    applicationId: string,
    rules: UpdateDenominatorFilterRuleInput[]
  ): Promise<DenominatorPreviewResult> {
    const modelFields = await this.denominatorModelRepository.getFields();
    const validatedRules = this.validateAndNormalizeRules(modelFields, rules);
    const currentRuleset = await this.getRulesByApplicationId(applicationId);

    const adoptionSettings = this.adoptionSettingsRepository
      ? await this.adoptionSettingsRepository.getByApplicationId(applicationId)
      : null;
    const revenueMetric = adoptionSettings?.revenueMetric ?? "ETD_ANSRAmt";

    const current = await this.denominatorFilterRepository.previewImpact(
      applicationId,
      currentRuleset.rules.map((rule) => ({
        denominatorModelId: rule.denominatorModelId,
        operator: rule.operator,
        value: rule.value
      })),
      modelFields,
      revenueMetric
    );

    const projected = await this.denominatorFilterRepository.previewImpact(
      applicationId,
      validatedRules,
      modelFields,
      revenueMetric
    );

    return {
      applicationId,
      current,
      projected,
      delta: {
        count: projected.count - current.count,
        revenue: Number((projected.revenue - current.revenue).toFixed(2))
      },
      calculatedAtUtc: new Date().toISOString()
    };
  }

  async getAdoptionSettings(applicationId: string): Promise<AdoptionSettings | null> {
    if (!this.adoptionSettingsRepository) {
      return null;
    }

    return this.adoptionSettingsRepository.getByApplicationId(applicationId);
  }

  async getAuditHistory(applicationId: string) {
    if (!this.denominatorAuditRepository) {
      return [];
    }

    return this.denominatorAuditRepository.listByApplicationId(applicationId);
  }

  async updateAdoptionSettings(
    applicationId: string,
    actorUserId: string,
    input: AdoptionSettingsUpdateInput
  ): Promise<AdoptionSettings> {
    if (!this.adoptionSettingsRepository) {
      throw new AppError(500, "INTERNAL_ERROR", "Adoption settings repository is not available.");
    }

    const modelFields = await this.denominatorModelRepository.getFields();
    const numericFields = modelFields.filter((f) => f.fieldType === "numeric" && f.isActive);
    const isValidRevenue = numericFields.some((f) => f.fieldName === input.revenueMetric);
    if (!isValidRevenue) {
      throw new AppError(
        400,
        "INVALID_REVENUE_METRIC",
        `'${input.revenueMetric}' is not a valid active numeric denominator field.`
      );
    }

    return this.adoptionSettingsRepository.upsert(applicationId, input, actorUserId);
  }

  private validateAndNormalizeRules(
    modelFields: DenominatorModelField[],
    rules: UpdateDenominatorFilterRuleInput[]
  ): UpdateDenominatorFilterRuleInput[] {
    return rules.map((rule) => {
      const field = this.resolveFilterableField(modelFields, rule.denominatorModelId);
      this.validateRuleValue(field.fieldType, rule.operator, rule.value);

      return {
        denominatorModelId: rule.denominatorModelId,
        operator: rule.operator,
        value: rule.value.trim()
      };
    });
  }

  private resolveFilterableField(fields: DenominatorModelField[], fieldId: string): DenominatorModelField {
    const field = fields.find((item) => item.denominatorModelId === fieldId);
    if (!field) {
      throw new AppError(400, "VALIDATION_ERROR", "Denominator model field was not found.");
    }

    if (!field.isFilterable) {
      throw new AppError(400, "FIELD_NOT_FILTERABLE", `Field '${field.fieldName}' is not marked as filterable.`);
    }

    return field;
  }

  private validateRuleValue(fieldType: "text" | "numeric" | "boolean" | "date", operator: string, value: string): void {
    if (!value || value.trim().length === 0) {
      throw new AppError(400, "VALIDATION_ERROR", "Rule value is required.");
    }

    FieldOperator.validate(fieldType, operator);

    if (fieldType === "numeric" && !/^-?\d+(\.\d+)?$/.test(value.trim())) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Numeric denominator fields only accept numeric values (integers or decimals)."
      );
    }

    if (fieldType === "boolean" && value.trim() !== "true" && value.trim() !== "false") {
      throw new AppError(400, "VALIDATION_ERROR", "Boolean denominator fields only accept 'true' or 'false'.");
    }

    if (fieldType === "date" && !DenominatorFilterService.isSqlDateLiteral(value)) {
      throw new AppError(400, "VALIDATION_ERROR", "Date denominator fields require SQL format YYYY-MM-DD.");
    }
  }
}
