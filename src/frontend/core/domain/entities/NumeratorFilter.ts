export type NumeratorFieldType = "text" | "numeric" | "boolean" | "date";

export interface NumeratorModelField {
  applicationModelFieldId: string;
  applicationId: string;
  fieldName: string;
  fieldType: NumeratorFieldType;
  isFilterable: boolean;
  isMetricDimension: boolean;
  displayOrder: number;
}

export interface NumeratorFilterRule {
  ruleId: string;
  applicationId: string;
  applicationModelFieldId: string;
  fieldName: string;
  fieldType: NumeratorFieldType;
  operator: string;
  value: string;
  ruleOrder: number;
  createdBy?: string;
  updatedBy?: string;
}

export interface UpdateNumeratorFilterRuleInput {
  applicationModelFieldId: string;
  operator: string;
  value: string;
}

export interface UpdateNumeratorFiltersInput {
  applicationId: string;
  actorUserId: string;
  rules: UpdateNumeratorFilterRuleInput[];
}

export interface NumeratorFilterRuleset {
  applicationId: string;
  applicationName: string;
  rules: NumeratorFilterRule[];
  lastUpdatedAt: string | null;
  lastUpdatedBy: string | null;
}
