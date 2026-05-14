import {
  DenominatorImpactSnapshot,
  DenominatorModelField,
  DenominatorFilterRuleset,
  UpdateDenominatorFilterRuleInput,
  UpdateDenominatorFiltersInput
} from "@/core/domain/entities/DenominatorFilter";
import { IDenominatorFilterRepository } from "@/core/domain/repositories/IDenominatorFilterRepository";
import {
  deactivateActiveDenominatorRulesByApplication,
  executeDenominatorPreviewAggregate,
  insertActiveDenominatorRule,
  insertDenominatorRuleChangeAudit,
  listActiveDenominatorRulesByApplication
} from "@/infrastructure/persistence/database/queries/denominator-filter-queries";
import { AppError } from "@/lib/api/error-handler";
import { SqlClient } from "@/lib/db/sql-client";

export class DenominatorFilterDbRepository implements IDenominatorFilterRepository {
  constructor(private readonly sqlClient: SqlClient) {}

  async getByApplicationId(applicationId: string): Promise<DenominatorFilterRuleset | null> {
    const rows = await listActiveDenominatorRulesByApplication(this.sqlClient, applicationId);
    if (rows.length === 0) {
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
      applicationName: rows[0].ApplicationName,
      rules: rows.map((row) => ({
        ruleId: row.RuleId,
        applicationId: row.ApplicationId,
        denominatorModelId: row.DenominatorModelId,
        fieldName: row.FieldName,
        fieldType: row.FieldType,
        operator: row.Operator,
        value: row.Value,
        ruleOrder: row.RuleOrder,
        updatedBy: row.UpdatedBy
      })),
      lastUpdatedAt: rows[0].UpdateDate,
      lastUpdatedBy: rows[0].UpdatedBy
    };
  }

  async updateRules(input: UpdateDenominatorFiltersInput): Promise<DenominatorFilterRuleset> {
    const previous = await this.getByApplicationId(input.applicationId);

    await deactivateActiveDenominatorRulesByApplication(
      this.sqlClient,
      input.applicationId,
      input.actorUserId
    );

    for (let index = 0; index < input.rules.length; index += 1) {
      const rule = input.rules[index];
      await insertActiveDenominatorRule(this.sqlClient, {
        ruleId: crypto.randomUUID(),
        applicationId: input.applicationId,
        denominatorModelId: rule.denominatorModelId,
        operator: rule.operator,
        value: rule.value,
        ruleOrder: index + 1,
        actorUserId: input.actorUserId
      });
    }

    const next = await this.getByApplicationId(input.applicationId);
    if (!next) {
      throw new AppError(500, "INTERNAL_ERROR", "Failed to load updated denominator rules.");
    }

    await insertDenominatorRuleChangeAudit(this.sqlClient, {
      auditId: crypto.randomUUID(),
      applicationId: input.applicationId,
      actorUserId: input.actorUserId,
      previousRulesJson: JSON.stringify(previous?.rules ?? []),
      newRulesJson: JSON.stringify(next.rules)
    });

    return next;
  }

  async previewImpact(
    _applicationId: string,
    rules: UpdateDenominatorFilterRuleInput[],
    modelFields: DenominatorModelField[],
    revenueMetric: string
  ): Promise<DenominatorImpactSnapshot> {
    const aggregate = await executeDenominatorPreviewAggregate(
      this.sqlClient,
      rules,
      modelFields.map((field) => ({
        denominatorModelId: field.denominatorModelId,
        sourceColumn: field.sourceColumn
      })),
      revenueMetric
    );

    return {
      count: Number(aggregate.Count ?? 0),
      revenue: Number(aggregate.Revenue ?? 0)
    };
  }
}
