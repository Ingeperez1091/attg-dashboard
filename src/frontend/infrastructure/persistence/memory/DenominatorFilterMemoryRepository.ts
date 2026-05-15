import {
  DenominatorImpactSnapshot,
  DenominatorModelField,
  DenominatorFilterRuleset,
  UpdateDenominatorFilterRuleInput,
  UpdateDenominatorFiltersInput
} from "@/core/domain/entities/DenominatorFilter";
import { IDenominatorFilterRepository } from "@/core/domain/repositories/IDenominatorFilterRepository";
import { createStoreAccessor } from "@/infrastructure/persistence/memory/sharedStore";

export type StoredDenominatorAuditEntry = {
  auditId: string;
  applicationId: string;
  actorUserId: string;
  previousRulesJson: string;
  newRulesJson: string;
  changeScope: "Denominator";
  changedAt: string;
};

const APPLICATION_NAMES: Record<string, string> = {
  "10000000-0000-0000-0000-000000000001": "Maestro",
  "10000000-0000-0000-0000-000000000002": "EYST",
  "10000000-0000-0000-0000-000000000003": "Prodigy",
  "10000000-0000-0000-0000-000000000004": "Vector",
  "10000000-0000-0000-0000-000000000005": "Navigate"
};

const MODEL_META: Record<string, { fieldName: string; fieldType: "text" | "numeric" | "date" }> = {
  "50000000-0000-0000-0001-000000000000": { fieldName: "EngagementID", fieldType: "text" },
  "50000000-0000-0000-0002-000000000000": { fieldName: "Engagement", fieldType: "text" },
  "50000000-0000-0000-0003-000000000000": { fieldName: "ClientID", fieldType: "text" },
  "50000000-0000-0000-0004-000000000000": { fieldName: "Client", fieldType: "text" },
  "50000000-0000-0000-0005-000000000000": { fieldName: "AccountChannel", fieldType: "text" },
  "50000000-0000-0000-0006-000000000000": { fieldName: "EngagementSubServiceLine", fieldType: "text" },
  "50000000-0000-0000-0007-000000000000": { fieldName: "EngagementServiceCode", fieldType: "text" },
  "50000000-0000-0000-0008-000000000000": { fieldName: "EngagementService", fieldType: "text" },
  "50000000-0000-0000-0009-000000000000": { fieldName: "EngagementStatus", fieldType: "text" },
  "50000000-0000-0000-000A-000000000000": { fieldName: "CreationDate", fieldType: "date" },
  "50000000-0000-0000-000B-000000000000": { fieldName: "ReleaseDate", fieldType: "date" },
  "50000000-0000-0000-000C-000000000000": { fieldName: "ETD_ANSRAmt", fieldType: "numeric" },
  "50000000-0000-0000-000D-000000000000": { fieldName: "FYTD_ANSRAmt", fieldType: "numeric" },
  "50000000-0000-0000-000E-000000000000": { fieldName: "ETD_TERAmt", fieldType: "numeric" },
  "50000000-0000-0000-000F-000000000000": { fieldName: "FYTD_TERAmt", fieldType: "numeric" },
  "50000000-0000-0000-0010-000000000000": { fieldName: "ETD_ChargedHours", fieldType: "numeric" },
  "50000000-0000-0000-0011-000000000000": { fieldName: "FYTD_ChargedHours", fieldType: "numeric" }
};

type DenominatorFilterMemoryStore = {
  rulesets: Record<string, DenominatorFilterRuleset>;
  audits: StoredDenominatorAuditEntry[];
};

function createEmptyRuleset(applicationId: string): DenominatorFilterRuleset | null {
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

const denominatorFilterStoreAccessor = createStoreAccessor<DenominatorFilterMemoryStore>({
  storeFilePath: process.env.TEST_FILTER_REPOSITORY_STORE_FILE,
  globalKey: "__dashboardDenominatorFilterRepoStore",
  createEmptyStore: () => ({
    rulesets: {
      "10000000-0000-0000-0000-000000000001": {
        applicationId: "10000000-0000-0000-0000-000000000001",
        applicationName: "Maestro",
        rules: [
          {
            ruleId: "80000000-0000-0000-0001-000000000001",
            applicationId: "10000000-0000-0000-0000-000000000001",
            denominatorModelId: "50000000-0000-0000-0007-000000000000",
            fieldName: "EngagementServiceCode",
            fieldType: "text",
            operator: "EQUALS",
            value: "11420",
            ruleOrder: 1,
            createdBy: "seed",
            updatedBy: "seed"
          }
        ],
        lastUpdatedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
        lastUpdatedBy: "seed"
      }
    },
    audits: []
  })
});

export class DenominatorFilterMemoryRepository implements IDenominatorFilterRepository {
  async getByApplicationId(applicationId: string): Promise<DenominatorFilterRuleset | null> {
    const existingRuleset = denominatorFilterStoreAccessor.getStore().rulesets[applicationId];
    if (existingRuleset) {
      return existingRuleset;
    }

    return createEmptyRuleset(applicationId);
  }

  async updateRules(input: UpdateDenominatorFiltersInput): Promise<DenominatorFilterRuleset> {
    const store = denominatorFilterStoreAccessor.getStore();
    const previousRuleset = store.rulesets[input.applicationId];
    const nextRuleset: DenominatorFilterRuleset = {
      applicationId: input.applicationId,
      applicationName: APPLICATION_NAMES[input.applicationId] ?? "Unknown",
      rules: input.rules.map((rule, index) => ({
        ruleId: crypto.randomUUID(),
        applicationId: input.applicationId,
        denominatorModelId: rule.denominatorModelId,
        fieldName: MODEL_META[rule.denominatorModelId]?.fieldName ?? "UnknownField",
        fieldType: MODEL_META[rule.denominatorModelId]?.fieldType ?? "text",
        operator: rule.operator,
        value: rule.value,
        ruleOrder: index + 1,
        createdBy: input.actorUserId,
        updatedBy: input.actorUserId
      })),
      lastUpdatedAt: new Date().toISOString(),
      lastUpdatedBy: input.actorUserId
    };

    store.rulesets[input.applicationId] = nextRuleset;
    store.audits.push({
      auditId: crypto.randomUUID(),
      applicationId: input.applicationId,
      actorUserId: input.actorUserId,
      previousRulesJson: JSON.stringify(previousRuleset?.rules ?? []),
      newRulesJson: JSON.stringify(nextRuleset.rules),
      changeScope: "Denominator",
      changedAt: new Date().toISOString()
    });
    denominatorFilterStoreAccessor.writeStore(store);
    return nextRuleset;
  }

  async previewImpact(
    _applicationId: string,
    rules: UpdateDenominatorFilterRuleInput[],
    _modelFields: DenominatorModelField[],
    _revenueMetric: string
  ): Promise<DenominatorImpactSnapshot> {
    const baseCount = 1200;
    const reduction = rules.reduce((total, rule, index) => {
      const payload = `${rule.denominatorModelId}|${rule.operator}|${rule.value}`;
      let hash = 0;
      for (let i = 0; i < payload.length; i += 1) {
        hash = ((hash << 5) - hash) + payload.charCodeAt(i);
        hash |= 0;
      }

      return total + (Math.abs(hash) % (70 + index * 5));
    }, 0);

    const count = Math.max(baseCount - reduction, 0);
    const revenue = Number((count * 1850.42).toFixed(2));

    return { count, revenue };
  }
}

export function getDenominatorAuditEntriesForTests(applicationId?: string): StoredDenominatorAuditEntry[] {
  const store = denominatorFilterStoreAccessor.getStore();
  if (!applicationId) return [...store.audits];
  return store.audits.filter((entry) => entry.applicationId === applicationId);
}
