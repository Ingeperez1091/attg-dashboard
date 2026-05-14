import {
  NumeratorFilterRuleset,
  NumeratorModelField,
  UpdateNumeratorFilterRuleInput,
  UpdateNumeratorFiltersInput
} from "@/core/domain/entities/NumeratorFilter";
import { INumeratorFilterRepository } from "@/core/domain/repositories/INumeratorFilterRepository";
import { AppError } from "@/lib/api/error-handler";
import { SqlClient } from "@/lib/db/sql-client";
import {
  deactivateActiveRulesByApplication,
  insertActiveRule,
  insertRuleChangeAudit,
  listActiveModelFieldsByApplication,
  listActiveRulesByApplication
} from "@/infrastructure/persistence/database/queries/numerator-filter-queries";

function toSqlBit(value: boolean | number | null | undefined): boolean {
  return value === true || value === 1;
}

export class NumeratorFilterDbRepository implements INumeratorFilterRepository {
  constructor(private readonly sqlClient: SqlClient) {}

  async getByApplicationId(applicationId: string): Promise<NumeratorFilterRuleset | null> {
    const rules = await listActiveRulesByApplication(this.sqlClient, applicationId);

    if (rules.length === 0) {
      return {
        applicationId,
        applicationName: "Unknown",
        rules: [],
        lastUpdatedAt: null,
        lastUpdatedBy: null
      };
    }

    return {
      applicationId,
      applicationName: rules[0].ApplicationName,
      rules: rules.map((row) => ({
        ruleId: row.RuleId,
        applicationId: row.ApplicationId,
        applicationModelFieldId: row.ApplicationModelFieldId,
        fieldName: row.FieldName,
        fieldType: row.FieldType,
        operator: row.Operator,
        value: row.Value,
        ruleOrder: row.RuleOrder,
        createdBy: row.CreatedBy,
        updatedBy: row.UpdatedBy
      })),
      lastUpdatedAt: rules[0].UpdateDate,
      lastUpdatedBy: rules[0].UpdatedBy
    };
  }

  async getModelByApplicationId(applicationId: string): Promise<NumeratorModelField[]> {
    const rows = await listActiveModelFieldsByApplication(this.sqlClient, applicationId);
    return rows.map((row) => ({
      applicationModelFieldId: row.ApplicationModelFieldId,
      applicationId: row.ApplicationId,
      fieldName: row.FieldName,
      fieldType: row.FieldType,
      isFilterable: toSqlBit(row.IsFilterable),
      isMetricDimension: toSqlBit(row.IsMetricDimension),
      displayOrder: row.DisplayOrder
    }));
  }

  async updateRules(input: UpdateNumeratorFiltersInput): Promise<NumeratorFilterRuleset> {
    const previous = await this.getByApplicationId(input.applicationId);

    await deactivateActiveRulesByApplication(this.sqlClient, input.applicationId, input.actorUserId);

    for (let i = 0; i < input.rules.length; i += 1) {
      const rule = input.rules[i] as UpdateNumeratorFilterRuleInput;
      await insertActiveRule(this.sqlClient, {
        ruleId: crypto.randomUUID(),
        applicationId: input.applicationId,
        applicationModelFieldId: rule.applicationModelFieldId,
        operator: rule.operator,
        value: rule.value,
        ruleOrder: i + 1,
        actorUserId: input.actorUserId
      });
    }

    const next = await this.getByApplicationId(input.applicationId);
    if (!next) {
      throw new AppError(500, "INTERNAL_ERROR", "Failed to load updated ruleset.");
    }

    await insertRuleChangeAudit(this.sqlClient, {
      auditId: crypto.randomUUID(),
      applicationId: input.applicationId,
      actorUserId: input.actorUserId,
      previousRulesJson: JSON.stringify(previous?.rules ?? []),
      newRulesJson: JSON.stringify(next.rules)
    });

    return next;
  }
}
