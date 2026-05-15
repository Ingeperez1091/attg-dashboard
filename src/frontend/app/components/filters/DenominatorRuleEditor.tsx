"use client";

import { useMemo, useState } from "react";
import { Spinner } from "@/app/components/Spinner";
import {
  DENOMINATOR_OPERATOR_LABELS,
  DENOMINATOR_OPERATORS_BY_TYPE,
  DenominatorModelFieldDto,
  DenominatorRuleExpressionDto
} from "@/core/application/dto/denominator/DenominatorFilterDto";

type DenominatorRuleEditorProps = {
  rules: DenominatorRuleExpressionDto[];
  fields: DenominatorModelFieldDto[];
  saving?: boolean;
  onUpdateRules: (rules: DenominatorRuleExpressionDto[]) => void;
  onSave: (rules: DenominatorRuleExpressionDto[]) => void;
  onCancel: () => void;
};

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

  const hasValidationErrors = validationErrors.some((item) => (
    item.missingOperator ||
    item.missingValue ||
    item.invalidListFormat ||
    item.invalidNumericValue ||
    item.invalidBooleanValue ||
    item.invalidDateValue
  ));

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
          <div key={index} style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
            <span>{index + 1}.</span>

            <select
              className="form-input"
              value={rule.denominatorModelId}
              onChange={(event) => {
                const nextFieldId = event.target.value;
                const nextField = fields.find((item) => item.denominatorModelId === nextFieldId);
                const nextOperators = nextField?.fieldType ? DENOMINATOR_OPERATORS_BY_TYPE[nextField.fieldType] : [];
                const nextOperator = nextOperators.includes(rule.operator) ? rule.operator : "";
                updateRule(index, { denominatorModelId: nextFieldId, operator: nextOperator });
              }}
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
              onChange={(event) => updateRule(index, { operator: event.target.value })}
              aria-invalid={showValidation && validationErrors[index].missingOperator}
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
              onChange={(event) => updateRule(index, { value: event.target.value })}
              placeholder={
                field?.fieldType === "numeric"
                  ? "e.g. 42 or 3.14"
                  : field?.fieldType === "boolean"
                    ? "true or false"
                    : field?.fieldType === "date"
                      ? "YYYY-MM-DD"
                  : rule.operator === "IN_LIST" || rule.operator === "NOT_IN_LIST"
                    ? "Value1;Value2"
                    : "Value"
              }
              aria-invalid={
                showValidation &&
                (
                  validationErrors[index].missingValue ||
                  validationErrors[index].invalidListFormat ||
                  validationErrors[index].invalidNumericValue ||
                  validationErrors[index].invalidBooleanValue ||
                  validationErrors[index].invalidDateValue
                )
              }
            />

            {showValidation &&
              (
                validationErrors[index].missingOperator ||
                validationErrors[index].missingValue ||
                validationErrors[index].invalidListFormat ||
                validationErrors[index].invalidNumericValue ||
                validationErrors[index].invalidBooleanValue ||
                validationErrors[index].invalidDateValue
              ) && (
              <span style={{ color: "#b42318", fontSize: "1rem" }}>
                {validationErrors[index].missingOperator
                  ? "Select an operator."
                  : validationErrors[index].missingValue
                    ? "Enter a value."
                    : validationErrors[index].invalidBooleanValue
                      ? "Only 'true' or 'false' are allowed."
                      : validationErrors[index].invalidNumericValue
                        ? "Only numeric values (e.g. 42 or 3.14) are allowed."
                        : validationErrors[index].invalidDateValue
                          ? "Use SQL date format YYYY-MM-DD."
                          : "Use semicolon-separated values (for example: Value1;Value2)."}
              </span>
            )}

            <button type="button" onClick={() => moveRule(index, -1)} disabled={index === 0}>
              ↑
            </button>
            <button type="button" onClick={() => moveRule(index, 1)} disabled={index === rules.length - 1}>
              ↓
            </button>
            <button
              type="button"
              className="btn btn--destructive btn--sm"
              onClick={() => removeRule(index)}
            >
              Remove
            </button>
          </div>
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
