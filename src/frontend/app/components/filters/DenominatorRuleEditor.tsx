"use client";

import { useMemo, useState } from "react";
import { Spinner } from "@/app/components/Spinner";
import {
  DENOMINATOR_OPERATOR_LABELS,
  DENOMINATOR_OPERATORS_BY_TYPE,
  DenominatorModelFieldDto,
  DenominatorRuleExpressionDto
} from "@/core/application/dto/denominator/DenominatorFilterDto";

type DenominatorRuleEditorProps = Readonly<{
  rules: DenominatorRuleExpressionDto[];
  fields: DenominatorModelFieldDto[];
  saving?: boolean;
  onUpdateRules: (rules: DenominatorRuleExpressionDto[]) => void;
  onSave: (rules: DenominatorRuleExpressionDto[]) => void;
  onCancel: () => void;
}>;

type RuleValidationErrors = {
  missingOperator: boolean;
  missingValue: boolean;
  invalidListFormat: boolean;
  invalidNumericValue: boolean;
  invalidBooleanValue: boolean;
  invalidDateValue: boolean;
};

function getPlaceholder(fieldType: string | undefined, operator: string): string {
  if (fieldType === "numeric") return "e.g. 42 or 3.14";
  if (fieldType === "boolean") return "true or false";
  if (fieldType === "date") return "YYYY-MM-DD";
  if (operator === "IN_LIST" || operator === "NOT_IN_LIST") return "Value1;Value2";
  return "Value";
}

function getValidationMessage(errors: RuleValidationErrors): string {
  if (errors.missingOperator) return "Select an operator.";
  if (errors.missingValue) return "Enter a value.";
  if (errors.invalidBooleanValue) return "Only 'true' or 'false' are allowed.";
  if (errors.invalidNumericValue) return "Only numeric values (e.g. 42 or 3.14) are allowed.";
  if (errors.invalidDateValue) return "Use SQL date format YYYY-MM-DD.";
  return "Use semicolon-separated values (for example: Value1;Value2).";
}

function hasRuleError(errors: RuleValidationErrors): boolean {
  return (
    errors.missingOperator ||
    errors.missingValue ||
    errors.invalidListFormat ||
    errors.invalidNumericValue ||
    errors.invalidBooleanValue ||
    errors.invalidDateValue
  );
}

function RuleRow({
  rule,
  index,
  field,
  filterableFields,
  operators,
  errors,
  showValidation,
  isFirst,
  isLast,
  onFieldChange,
  onOperatorChange,
  onValueChange,
  onMoveUp,
  onMoveDown,
  onRemove
}: Readonly<{
  rule: DenominatorRuleExpressionDto;
  index: number;
  field: DenominatorModelFieldDto | undefined;
  filterableFields: DenominatorModelFieldDto[];
  operators: string[];
  errors: RuleValidationErrors;
  showValidation: boolean;
  isFirst: boolean;
  isLast: boolean;
  onFieldChange: (nextFieldId: string) => void;
  onOperatorChange: (nextOperator: string) => void;
  onValueChange: (nextValue: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}>) {
  const ruleHasError = hasRuleError(errors);

  return (
    <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
      <span>{index + 1}.</span>

      <select
        className="form-input"
        value={rule.denominatorModelId}
        onChange={(event) => onFieldChange(event.target.value)}
      >
        {filterableFields.map((item) => (
          <option key={item.denominatorModelId} value={item.denominatorModelId}>
            {item.fieldName} ({item.fieldType})
          </option>
        ))}
      </select>

      <select
        className="form-input"
        value={rule.operator}
        onChange={(event) => onOperatorChange(event.target.value)}
        aria-invalid={showValidation && errors.missingOperator}
      >
        <option value="">Select operator</option>
        {operators.map((operator) => (
          <option key={operator} value={operator}>
            {DENOMINATOR_OPERATOR_LABELS[operator] ?? operator}
          </option>
        ))}
      </select>

      <input
        type="text"
        className="form-input"
        value={rule.value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={getPlaceholder(field?.fieldType, rule.operator)}
        aria-invalid={
          showValidation &&
          (errors.missingValue || errors.invalidListFormat || errors.invalidNumericValue || errors.invalidBooleanValue || errors.invalidDateValue)
        }
      />

      {showValidation && ruleHasError && (
        <span style={{ color: "#b42318", fontSize: "1rem" }}>
          {getValidationMessage(errors)}
        </span>
      )}

      <button type="button" onClick={onMoveUp} disabled={isFirst}>↑</button>
      <button type="button" onClick={onMoveDown} disabled={isLast}>↓</button>
      <button type="button" className="btn btn--destructive btn--sm" onClick={onRemove}>
        Remove
      </button>
    </div>
  );
}

export function DenominatorRuleEditor({
  rules,
  fields,
  saving = false,
  onUpdateRules,
  onSave,
  onCancel
}: DenominatorRuleEditorProps) {
  const [showValidation, setShowValidation] = useState(false);
  const filterableFields = fields.filter((field) => field.isFilterable);

  const validationErrors = useMemo(() => rules.map((rule) => {
    const field = fields.find((item) => item.denominatorModelId === rule.denominatorModelId);
    const operators = field?.fieldType ? DENOMINATOR_OPERATORS_BY_TYPE[field.fieldType] : [];
    const missingOperator = !rule.operator || !operators.includes(rule.operator);
    const missingValue = !rule.value.trim();
    const isListOperator = rule.operator === "IN_LIST" || rule.operator === "NOT_IN_LIST";
    const listParts = rule.value.split(";").map((item) => item.trim());
    const invalidListFormat =
      isListOperator &&
      !missingValue &&
      !(listParts.length >= 2 && listParts.every((item) => item.length > 0));
    const invalidNumericValue =
      field?.fieldType === "numeric" &&
      !missingValue &&
      !/^-?\d+(\.\d+)?$/.test(rule.value.trim());
    const invalidBooleanValue =
      field?.fieldType === "boolean" &&
      !missingValue &&
      rule.value.trim() !== "true" &&
      rule.value.trim() !== "false";
    const invalidDateValue =
      field?.fieldType === "date" &&
      !missingValue &&
      !/^\d{4}-\d{2}-\d{2}$/.test(rule.value.trim());

    return {
      missingOperator,
      missingValue,
      invalidListFormat,
      invalidNumericValue,
      invalidBooleanValue,
      invalidDateValue
    };
  }), [fields, rules]);

  const hasValidationErrors = validationErrors.some((item) => hasRuleError(item));

  function updateRule(index: number, updates: Partial<DenominatorRuleExpressionDto>): void {
    if (showValidation) {
      setShowValidation(false);
    }

    const nextRules = [...rules];
    nextRules[index] = { ...nextRules[index], ...updates };
    onUpdateRules(nextRules);
  }

  function addRule(): void {
    if (filterableFields.length === 0) {
      return;
    }

    onUpdateRules([
      ...rules,
      {
        denominatorModelId: filterableFields[0].denominatorModelId,
        operator: "",
        value: ""
      }
    ]);
  }

  function removeRule(index: number): void {
    onUpdateRules(rules.filter((_, ruleIndex) => ruleIndex !== index));
  }

  function moveRule(index: number, direction: number): void {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= rules.length) {
      return;
    }

    const nextRules = [...rules];
    [nextRules[index], nextRules[newIndex]] = [nextRules[newIndex], nextRules[index]];
    onUpdateRules(nextRules);
  }

  return (
    <section className="card">
      <h3>Edit Denominator Rules</h3>

      {rules.length === 0 && <p>No rules. Click "Add Rule" to create one.</p>}

      {rules.map((rule, index) => {
        const field = fields.find((item) => item.denominatorModelId === rule.denominatorModelId);
        const operators = field?.fieldType ? DENOMINATOR_OPERATORS_BY_TYPE[field.fieldType] : [];

        return (
          <RuleRow
            key={`${rule.denominatorModelId}-${index}`}
            rule={rule}
            index={index}
            field={field}
            filterableFields={filterableFields}
            operators={operators}
            errors={validationErrors[index]}
            showValidation={showValidation}
            isFirst={index === 0}
            isLast={index === rules.length - 1}
            onFieldChange={(nextFieldId) => {
              const nextField = fields.find((item) => item.denominatorModelId === nextFieldId);
              const nextOperators = nextField?.fieldType ? DENOMINATOR_OPERATORS_BY_TYPE[nextField.fieldType] : [];
              const nextOperator = nextOperators.includes(rule.operator) ? rule.operator : "";
              updateRule(index, { denominatorModelId: nextFieldId, operator: nextOperator });
            }}
            onOperatorChange={(nextOperator) => updateRule(index, { operator: nextOperator })}
            onValueChange={(nextValue) => updateRule(index, { value: nextValue })}
            onMoveUp={() => moveRule(index, -1)}
            onMoveDown={() => moveRule(index, 1)}
            onRemove={() => removeRule(index)}
          />
        );
      })}

      {showValidation && hasValidationErrors && (
        <div className="admin-alert" role="alert" style={{ marginTop: "0.5rem" }}>
          Complete each rule with a valid operator and value. Boolean fields accept only 'true' or 'false'. Date fields
          must use YYYY-MM-DD. IN_LIST and NOT_IN_LIST require semicolon-separated values.
        </div>
      )}

      <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
        <button type="button" className="filter-rule-btn filter-rule-btn-add" onClick={addRule}>
          Add Rule
        </button>
        <button
          type="button"
          className="filter-rule-btn filter-rule-btn-save"
          onClick={() => {
            if (hasValidationErrors) {
              setShowValidation(true);
              return;
            }

            onSave(rules);
          }}
          disabled={saving}
        >
          {saving ? <Spinner size="sm" label="Saving..." inline /> : "Save"}
        </button>
        <button type="button" className="filter-rule-btn filter-rule-btn-cancel" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </section>
  );
}
