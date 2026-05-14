import { AppError } from "@/lib/api/error-handler";

export type FieldType = "text" | "numeric" | "boolean" | "date";

const OPERATORS_BY_TYPE: Record<FieldType, string[]> = {
  text: ["EQUALS", "NOT_EQUALS", "CONTAINS", "NOT_CONTAINS", "IN_LIST", "NOT_IN_LIST"],
  numeric: ["EQUALS", "NOT_EQUALS", "GREATER_THAN", "GREATER_OR_EQUAL", "LESS_THAN", "LESS_OR_EQUAL"],
  boolean: ["EQUALS"],
  date: ["EQUALS", "GREATER_THAN", "GREATER_OR_EQUAL", "LESS_THAN", "LESS_OR_EQUAL"]
};

export class FieldOperator {
  static validate(fieldType: FieldType, operator: string): void {
    const valid = OPERATORS_BY_TYPE[fieldType] ?? [];
    if (!valid.includes(operator)) {
      throw new AppError(400, "VALIDATION_ERROR", `Operator '${operator}' not valid for field type '${fieldType}'.`);
    }
  }

  static list(fieldType: FieldType): string[] {
    return OPERATORS_BY_TYPE[fieldType] ?? [];
  }
}
