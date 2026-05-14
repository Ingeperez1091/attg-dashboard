import { AppError } from "@/lib/api/error-handler";
import { FieldOperator, FieldType } from "@/core/domain/value-objects/FieldOperator";

export interface FilterRuleProps {
  applicationModelFieldId: string;
  operator: string;
  value: string;
  ruleOrder: number;
}

export class FilterRule {
  constructor(readonly props: FilterRuleProps) {}

  private static isSqlDateLiteral(value: string): boolean {
    const normalized = value.trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(normalized);
  }

  private static isSemicolonSeparatedList(value: string): boolean {
    const parts = value.split(";").map((item) => item.trim());
    return parts.length >= 2 && parts.every((item) => item.length > 0);
  }

  private static validateValueForType(fieldType: FieldType, value: string): void {
    if (fieldType === "boolean") {
      if (value !== "true" && value !== "false") {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "Boolean fields only accept 'true' or 'false' as values."
        );
      }
    }

    if (fieldType === "numeric") {
      if (!/^-?\d+(\.\d+)?$/.test(value.trim())) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "Numeric fields only accept numeric values (integers or decimals)."
        );
      }
    }

    if (fieldType === "date") {
      if (!FilterRule.isSqlDateLiteral(value)) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "Date fields only accept SQL date format YYYY-MM-DD."
        );
      }
    }
  }

  validate(fieldType: FieldType): void {
    if (!this.props.applicationModelFieldId) {
      throw new AppError(400, "VALIDATION_ERROR", "applicationModelFieldId is required.");
    }

    if (!this.props.value || this.props.value.trim().length === 0) {
      throw new AppError(400, "VALIDATION_ERROR", "value is required.");
    }

    if (this.props.ruleOrder <= 0) {
      throw new AppError(400, "VALIDATION_ERROR", "ruleOrder must be greater than 0.");
    }

    if (
      (this.props.operator === "IN_LIST" || this.props.operator === "NOT_IN_LIST") &&
      !FilterRule.isSemicolonSeparatedList(this.props.value)
    ) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "IN_LIST and NOT_IN_LIST values must be semicolon-separated (for example: value1;value2)."
      );
    }

    FieldOperator.validate(fieldType, this.props.operator);

    FilterRule.validateValueForType(fieldType, this.props.value);
  }
}
