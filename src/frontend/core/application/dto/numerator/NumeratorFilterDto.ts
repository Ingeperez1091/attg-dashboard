export type NumeratorFieldType = "text" | "numeric" | "boolean" | "date";

export interface NumeratorModelFieldDto {
  applicationModelFieldId: string;
  fieldName: string;
  fieldType: NumeratorFieldType;
  isFilterable: boolean;
}

export interface NumeratorRuleViewDto {
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

export interface NumeratorRuleExpressionDto {
  applicationModelId: string;
  operator: string;
  value: string;
}

export interface NumeratorRulesetDto {
  rules: NumeratorRuleViewDto[];
  lastUpdatedAt: string | null;
  lastUpdatedBy: string | null;
}

export interface NumeratorApplicationModelDto {
  fields: NumeratorModelFieldDto[];
}

export const NUMERATOR_OPERATOR_LABELS: Record<string, string> = {
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

export const NUMERATOR_OPERATORS_BY_TYPE: Record<NumeratorFieldType, string[]> = {
  text: ["EQUALS", "NOT_EQUALS", "CONTAINS", "NOT_CONTAINS", "IN_LIST", "NOT_IN_LIST"],
  numeric: ["EQUALS", "NOT_EQUALS", "GREATER_THAN", "GREATER_OR_EQUAL", "LESS_THAN", "LESS_OR_EQUAL"],
  boolean: ["EQUALS"],
  date: ["EQUALS", "GREATER_THAN", "GREATER_OR_EQUAL", "LESS_THAN", "LESS_OR_EQUAL"]
};
