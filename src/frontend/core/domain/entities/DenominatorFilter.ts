export type DenominatorFieldType = "text" | "numeric" | "boolean" | "date";

export interface DenominatorModelField {
  denominatorModelId: string;
  fieldName: string;
  fieldType: DenominatorFieldType;
  sourceColumn: string;
  isFilterable: boolean;
  displayOrder: number;
  isActive: boolean;
}

export interface DenominatorFilterRule {
  ruleId: string;
  applicationId: string;
  denominatorModelId: string;
  fieldName: string;
  fieldType: DenominatorFieldType;
  operator: string;
  value: string;
  ruleOrder: number;
  createdBy?: string;
  updatedBy?: string;
}

export interface DenominatorFilterRuleset {
  applicationId: string;
  applicationName: string;
  rules: DenominatorFilterRule[];
  lastUpdatedAt: string | null;
  lastUpdatedBy: string | null;
}

export interface UpdateDenominatorFilterRuleInput {
  denominatorModelId: string;
  operator: string;
  value: string;
}

export interface UpdateDenominatorFiltersInput {
  applicationId: string;
  actorUserId: string;
  rules: UpdateDenominatorFilterRuleInput[];
}

export interface DenominatorImpactSnapshot {
  count: number;
  revenue: number;
}

export interface DenominatorPreviewResult {
  applicationId: string;
  current: DenominatorImpactSnapshot;
  projected: DenominatorImpactSnapshot;
  delta: DenominatorImpactSnapshot;
  calculatedAtUtc: string;
}

export interface DenominatorAuditHistoryEntry {
  auditId: string;
  applicationId: string;
  actorUserId: string;
  changeScope: "Denominator" | "Adoption";
  previousRulesJson: string | null;
  newRulesJson: string;
  changedAt: string;
}

export interface AdoptionSettings {
  applicationId: string;
  adoptionLevel: "Engagement" | "Client";
  revenueMetric: string;
  numeratorSource: "API" | "Manual";
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface AdoptionSettingsUpdateInput {
  adoptionLevel: "Engagement" | "Client";
  revenueMetric: string;
  numeratorSource: "API" | "Manual";
}
