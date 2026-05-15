import {
  NumeratorFilterRuleset,
  NumeratorModelField,
  NumeratorFieldType,
  UpdateNumeratorFiltersInput
} from "@/core/domain/entities/NumeratorFilter";
import { INumeratorFilterRepository } from "@/core/domain/repositories/INumeratorFilterRepository";
import { createStoreAccessor } from "./sharedStore";

const MODEL_FIELDS: Record<string, { FieldName: string; FieldType: string; ApplicationId: string }> = {
  // Maestro
  "40000000-0000-0000-0101-000000000001": { FieldName: "EngagementId", FieldType: "string", ApplicationId: "10000000-0000-0000-0000-000000000001" },
  "40000000-0000-0000-0102-000000000001": { FieldName: "ClientId", FieldType: "string", ApplicationId: "10000000-0000-0000-0000-000000000001" },
  "40000000-0000-0000-0103-000000000001": { FieldName: "ClientName", FieldType: "string", ApplicationId: "10000000-0000-0000-0000-000000000001" },
  "40000000-0000-0000-0104-000000000001": { FieldName: "EngagementName", FieldType: "string", ApplicationId: "10000000-0000-0000-0000-000000000001" },
  "40000000-0000-0000-0105-000000000001": { FieldName: "InMaestro", FieldType: "boolean", ApplicationId: "10000000-0000-0000-0000-000000000001" },
  // EYST
  "40000000-0000-0000-0201-000000000002": { FieldName: "ClientId", FieldType: "string", ApplicationId: "10000000-0000-0000-0000-000000000002" },
  "40000000-0000-0000-0202-000000000002": { FieldName: "ClientName", FieldType: "string", ApplicationId: "10000000-0000-0000-0000-000000000002" },
  "40000000-0000-0000-0203-000000000002": { FieldName: "EngagementCount", FieldType: "number", ApplicationId: "10000000-0000-0000-0000-000000000002" },
  "40000000-0000-0000-0204-000000000002": { FieldName: "TotalRevenueETD", FieldType: "number", ApplicationId: "10000000-0000-0000-0000-000000000002" },
  "40000000-0000-0000-0205-000000000002": { FieldName: "EYSTActive", FieldType: "string", ApplicationId: "10000000-0000-0000-0000-000000000002" },
  "40000000-0000-0000-0206-000000000002": { FieldName: "EYSTDataCleanupActive", FieldType: "string", ApplicationId: "10000000-0000-0000-0000-000000000002" },
  "40000000-0000-0000-0207-000000000002": { FieldName: "Notes", FieldType: "string", ApplicationId: "10000000-0000-0000-0000-000000000002" },
  // Prodigy
  "40000000-0000-0000-0301-000000000003": { FieldName: "ClientId", FieldType: "string", ApplicationId: "10000000-0000-0000-0000-000000000003" },
  "40000000-0000-0000-0302-000000000003": { FieldName: "ClientName", FieldType: "string", ApplicationId: "10000000-0000-0000-0000-000000000003" },
  "40000000-0000-0000-0303-000000000003": { FieldName: "EngagementCount", FieldType: "number", ApplicationId: "10000000-0000-0000-0000-000000000003" },
  "40000000-0000-0000-0304-000000000003": { FieldName: "TotalRevenueFYTD", FieldType: "number", ApplicationId: "10000000-0000-0000-0000-000000000003" },
  "40000000-0000-0000-0305-000000000003": { FieldName: "InProdigy", FieldType: "string", ApplicationId: "10000000-0000-0000-0000-000000000003" },
  "40000000-0000-0000-0306-000000000003": { FieldName: "Override", FieldType: "string", ApplicationId: "10000000-0000-0000-0000-000000000003" },
  "40000000-0000-0000-0307-000000000003": { FieldName: "Notes", FieldType: "string", ApplicationId: "10000000-0000-0000-0000-000000000003" },
  // Vector
  "40000000-0000-0000-0401-000000000004": { FieldName: "EngagementId", FieldType: "string", ApplicationId: "10000000-0000-0000-0000-000000000004" },
  "40000000-0000-0000-0402-000000000004": { FieldName: "ClientId", FieldType: "string", ApplicationId: "10000000-0000-0000-0000-000000000004" },
  "40000000-0000-0000-0403-000000000004": { FieldName: "ClientName", FieldType: "string", ApplicationId: "10000000-0000-0000-0000-000000000004" },
  "40000000-0000-0000-0404-000000000004": { FieldName: "RevenueFYTD", FieldType: "number", ApplicationId: "10000000-0000-0000-0000-000000000004" },
  "40000000-0000-0000-0405-000000000004": { FieldName: "RevenueETD", FieldType: "number", ApplicationId: "10000000-0000-0000-0000-000000000004" },
  "40000000-0000-0000-0406-000000000004": { FieldName: "VectorEngagement", FieldType: "string", ApplicationId: "10000000-0000-0000-0000-000000000004" },
  // Navigate
  "40000000-0000-0000-0501-000000000005": { FieldName: "EngagementId", FieldType: "string", ApplicationId: "10000000-0000-0000-0000-000000000005" },
  "40000000-0000-0000-0502-000000000005": { FieldName: "ClientId", FieldType: "string", ApplicationId: "10000000-0000-0000-0000-000000000005" },
  "40000000-0000-0000-0503-000000000005": { FieldName: "ClientName", FieldType: "string", ApplicationId: "10000000-0000-0000-0000-000000000005" },
  "40000000-0000-0000-0504-000000000005": { FieldName: "EngagementName", FieldType: "string", ApplicationId: "10000000-0000-0000-0000-000000000005" },
  "40000000-0000-0000-0505-000000000005": { FieldName: "RevenueFYTD", FieldType: "number", ApplicationId: "10000000-0000-0000-0000-000000000005" },
  "40000000-0000-0000-0506-000000000005": { FieldName: "NavigateStatus", FieldType: "string", ApplicationId: "10000000-0000-0000-0000-000000000005" },
  "40000000-0000-0000-0507-000000000005": { FieldName: "Notes", FieldType: "string", ApplicationId: "10000000-0000-0000-0000-000000000005" },
  "40000000-0000-0000-0508-000000000005": { FieldName: "EffectiveDate", FieldType: "date", ApplicationId: "10000000-0000-0000-0000-000000000005" }
};

const APPLICATION_NAMES: Record<string, string> = {
  "10000000-0000-0000-0000-000000000001": "Maestro",
  "10000000-0000-0000-0000-000000000002": "EYST",
  "10000000-0000-0000-0000-000000000003": "Prodigy",
  "10000000-0000-0000-0000-000000000004": "Vector",
  "10000000-0000-0000-0000-000000000005": "Navigate"
};

type StoredRuleRow = {
  RuleId: string;
  ApplicationId: string;
  ApplicationModelFieldId: string;
  Operator: string;
  Value: string;
  RuleOrder: number;
  IsActive: boolean;
  CreateDate: Date;
  CreatedBy: string;
  UpdateDate: Date;
  UpdatedBy: string;
};

type StoredAuditEntry = {
  AuditId: string;
  ApplicationId: string;
  ActorUserId: string;
  PreviousRulesJson: string;
  NewRulesJson: string;
  ChangedAt: Date;
};

type FilterRepoStore = {
  rules: StoredRuleRow[];
  audits: StoredAuditEntry[];
};

const filterStoreAccessor = createStoreAccessor<FilterRepoStore>({
  storeFilePath: process.env.TEST_FILTER_REPOSITORY_STORE_FILE,
  globalKey: "__dashboardFilterRepoStore",
  createEmptyStore: () => ({ rules: [], audits: [] }),
  reviveStore: (raw) => ({
    rules: raw.rules.map((rule) => ({
      ...rule,
      CreateDate: new Date(rule.CreateDate),
      UpdateDate: new Date(rule.UpdateDate)
    })),
    audits: raw.audits.map((audit) => ({
      ...audit,
      ChangedAt: new Date(audit.ChangedAt)
    }))
  })
});

function makeId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function toNumeratorFieldType(fieldType: string): NumeratorFieldType {
  switch (fieldType) {
    case "number":
      return "numeric";
    case "boolean":
      return "boolean";
    case "date":
      return "date";
    default:
      return "text";
  }
}

function buildModelFieldsByApplication(): Map<string, NumeratorModelField[]> {
  const grouped = new Map<string, NumeratorModelField[]>();
  const metricDimensionFieldNamesByApplication: Record<string, string> = {
    "10000000-0000-0000-0000-000000000001": "InMaestro",
    "10000000-0000-0000-0000-000000000002": "TotalRevenueETD",
    "10000000-0000-0000-0000-000000000003": "TotalRevenueFYTD",
    "10000000-0000-0000-0000-000000000004": "RevenueETD",
    "10000000-0000-0000-0000-000000000005": "RevenueFYTD"
  };

  for (const [applicationModelFieldId, field] of Object.entries(MODEL_FIELDS)) {
    const existing = grouped.get(field.ApplicationId) ?? [];

    existing.push({
      applicationModelFieldId,
      applicationId: field.ApplicationId,
      fieldName: field.FieldName,
      fieldType: toNumeratorFieldType(field.FieldType),
      isFilterable: field.FieldName !== "Notes",
      isMetricDimension: metricDimensionFieldNamesByApplication[field.ApplicationId] === field.FieldName,
      displayOrder: existing.length + 1
    });

    grouped.set(field.ApplicationId, existing);
  }

  return grouped;
}

export class NumeratorFilterMemoryRepository implements INumeratorFilterRepository {
  private readonly modelFieldsByApplication = buildModelFieldsByApplication();

  async getByApplicationId(applicationId: string): Promise<NumeratorFilterRuleset | null> {
    const store = filterStoreAccessor.getStore();
    const activeRules = store.rules
      .filter((rule) => rule.ApplicationId === applicationId && rule.IsActive)
      .sort((a, b) => a.RuleOrder - b.RuleOrder);

    if (activeRules.length === 0) {
      const applicationName = APPLICATION_NAMES[applicationId];
      if (!applicationName) {
        return null;
      }

      return {
        applicationId,
        applicationName,
        rules: [],
        lastUpdatedAt: null,
        lastUpdatedBy: null
      };
    }

    const modelFields = this.modelFieldsByApplication.get(applicationId) ?? [];
    const normalizedRules = activeRules.map((rule) => {
      const matchedField = modelFields.find(
        (field) => field.applicationModelFieldId === rule.ApplicationModelFieldId
      );

      return {
        ruleId: rule.RuleId,
        applicationId: rule.ApplicationId,
        applicationModelFieldId: rule.ApplicationModelFieldId,
        fieldName: matchedField?.fieldName ?? "UnknownField",
        fieldType: matchedField?.fieldType ?? "text",
        operator: rule.Operator,
        value: rule.Value,
        ruleOrder: rule.RuleOrder,
        createdBy: rule.CreatedBy,
        updatedBy: rule.UpdatedBy
      };
    });

    const latestUpdated = activeRules.reduce((latest, current) => (
      current.UpdateDate > latest.UpdateDate ? current : latest
    ));

    return {
      applicationId,
      applicationName: APPLICATION_NAMES[applicationId] ?? "Unknown",
      rules: normalizedRules,
      lastUpdatedAt: latestUpdated.UpdateDate.toISOString(),
      lastUpdatedBy: latestUpdated.UpdatedBy
    };
  }

  async getModelByApplicationId(applicationId: string): Promise<NumeratorModelField[]> {
    return this.modelFieldsByApplication.get(applicationId) ?? [];
  }

  async updateRules(input: UpdateNumeratorFiltersInput): Promise<NumeratorFilterRuleset> {
    const store = filterStoreAccessor.getStore();
    const ts = new Date();
    const modelFields = this.modelFieldsByApplication.get(input.applicationId) ?? [];
    const previousRuleset = await this.getByApplicationId(input.applicationId);

    store.rules
      .filter((rule) => rule.ApplicationId === input.applicationId && rule.IsActive)
      .forEach((rule) => {
        rule.IsActive = false;
        rule.UpdateDate = ts;
        rule.UpdatedBy = input.actorUserId;
      });

    const newRows: StoredRuleRow[] = input.rules.map((rule, index) => ({
      RuleId: makeId(),
      ApplicationId: input.applicationId,
      ApplicationModelFieldId: rule.applicationModelFieldId,
      Operator: rule.operator,
      Value: rule.value,
      RuleOrder: index + 1,
      IsActive: true,
      CreateDate: ts,
      CreatedBy: input.actorUserId,
      UpdateDate: ts,
      UpdatedBy: input.actorUserId
    }));

    store.rules.push(...newRows);

    store.audits.push({
      AuditId: makeId(),
      ApplicationId: input.applicationId,
      ActorUserId: input.actorUserId,
      PreviousRulesJson: JSON.stringify((previousRuleset?.rules ?? []).map((rule) => ({
        ruleId: rule.ruleId,
        applicationModelFieldId: rule.applicationModelFieldId,
        fieldName: rule.fieldName,
        operator: rule.operator,
        value: rule.value,
        ruleOrder: rule.ruleOrder
      }))),
      NewRulesJson: JSON.stringify(newRows.map((rule) => ({
        ruleId: rule.RuleId,
        applicationModelFieldId: rule.ApplicationModelFieldId,
        fieldName: modelFields.find((field) => field.applicationModelFieldId === rule.ApplicationModelFieldId)?.fieldName ?? "UnknownField",
        operator: rule.Operator,
        value: rule.Value,
        ruleOrder: rule.RuleOrder
      }))),
      ChangedAt: ts
    });

    filterStoreAccessor.writeStore(store);

    const nextRuleset: NumeratorFilterRuleset = {
      applicationId: input.applicationId,
      applicationName: APPLICATION_NAMES[input.applicationId] ?? "Navigate",
      rules: newRows.map((storedRow) => {
        const matchedField = modelFields.find(
          (field) => field.applicationModelFieldId === storedRow.ApplicationModelFieldId
        );

        return {
          ruleId: storedRow.RuleId,
          applicationId: input.applicationId,
          applicationModelFieldId: storedRow.ApplicationModelFieldId,
          fieldName: matchedField?.fieldName ?? "UnknownField",
          fieldType: matchedField?.fieldType ?? "text",
          operator: storedRow.Operator,
          value: storedRow.Value,
          ruleOrder: storedRow.RuleOrder,
          createdBy: input.actorUserId,
          updatedBy: input.actorUserId
        };
      }),
      lastUpdatedAt: ts.toISOString(),
      lastUpdatedBy: input.actorUserId
    };

    return nextRuleset;
  }
}
