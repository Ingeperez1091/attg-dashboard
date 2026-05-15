export type DenominatorFieldType = "text" | "numeric" | "boolean" | "date";

export interface DenominatorModelFieldDto {
  denominatorModelId: string;
  fieldName: string;
  fieldType: DenominatorFieldType;
  sourceColumn: string;
  isFilterable: boolean;
  displayOrder: number;
  isActive: boolean;
}

export interface DenominatorRuleViewDto {
  ruleId: string;
  applicationId: string;
  denominatorModelId: string;
  fieldName: string;
  fieldType: DenominatorFieldType;
  operator: string;
  value: string;
  ruleOrder: number;
}

export interface DenominatorRulesetDto {
  rules: DenominatorRuleViewDto[];
  lastUpdatedAt: string | null;
  lastUpdatedBy: string | null;
}

export interface DenominatorRuleExpressionDto {
  denominatorModelId: string;
  operator: string;
  value: string;
}

export interface DenominatorImpactSnapshotDto {
  count: number;
  revenue: number;
}

export interface DenominatorPreviewResultDto {
  applicationId: string;
  current: DenominatorImpactSnapshotDto;
  projected: DenominatorImpactSnapshotDto;
  delta: DenominatorImpactSnapshotDto;
  calculatedAtUtc: string;
}

export interface AdoptionSettingsDto {
  applicationId: string;
  adoptionLevel: "Engagement" | "Client" | null;
  revenueMetric: string | null;
  numeratorSource: "API" | "Manual" | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface AdoptionSettingsUpdateDto {
  adoptionLevel: "Engagement" | "Client";
  revenueMetric: string;
  numeratorSource: "API" | "Manual";
}

export interface DenominatorAuditHistoryEntryDto {
  auditId: string;
  applicationId: string;
  actorUserId: string;
  changeScope: "Denominator" | "Adoption";
  previousRulesJson: string | null;
  newRulesJson: string;
  changedAt: string;
}

export const DENOMINATOR_OPERATOR_LABELS: Record<string, string> = {
  EQUALS: "Equals",
  NOT_EQUALS: "Not Equals",
  CONTAINS: "Contains",
  NOT_CONTAINS: "Does Not Contain",
  IN_LIST: "In List",
  NOT_IN_LIST: "Not In List",
  GREATER_THAN: "Greater Than",
  GREATER_OR_EQUAL: "Greater Than or Equal",
  LESS_THAN: "Less Than",
  LESS_OR_EQUAL: "Less Than or Equal"
};

export const DENOMINATOR_OPERATORS_BY_TYPE: Record<DenominatorFieldType, string[]> = {
  text: ["EQUALS", "NOT_EQUALS", "CONTAINS", "NOT_CONTAINS", "IN_LIST", "NOT_IN_LIST"],
  numeric: ["EQUALS", "NOT_EQUALS", "GREATER_THAN", "GREATER_OR_EQUAL", "LESS_THAN", "LESS_OR_EQUAL"],
  boolean: ["EQUALS"],
  date: ["EQUALS", "GREATER_THAN", "GREATER_OR_EQUAL", "LESS_THAN", "LESS_OR_EQUAL"]
};
