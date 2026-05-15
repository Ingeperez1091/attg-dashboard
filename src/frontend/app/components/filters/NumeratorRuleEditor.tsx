"use client";

import { useMemo, useState } from "react";
import { Spinner } from "@/app/components/Spinner";
import {
  NUMERATOR_OPERATOR_LABELS,
  NUMERATOR_OPERATORS_BY_TYPE,
  NumeratorModelFieldDto,
  NumeratorRuleExpressionDto
} from "@/core/application/dto/numerator/NumeratorFilterDto";

type NumeratorRuleEditorProps = {
  rules: NumeratorRuleExpressionDto[];
  fields: NumeratorModelFieldDto[];
  saving?: boolean;
  onUpdateRules: (rules: NumeratorRuleExpressionDto[]) => void;
  onSave: (rules: NumeratorRuleExpressionDto[]) => void;
  onCancel: () => void;
};

export function NumeratorRuleEditor({
  rules,
  fields,
  saving = false,
  onUpdateRules,
  onSave,
  onCancel
}: NumeratorRuleEditorProps) {
  const [showValidation, setShowValidation] = useState(false);
  const filterableFields = fields.filter((f) => f.isFilterable);

  const validationErrors = useMemo(
    () =>
      rules.map((rule) => {
        const field = fields.find((f) => f.applicationModelFieldId === rule.applicationModelId);
        const operators = field?.fieldType ? NUMERATOR_OPERATORS_BY_TYPE[field.fieldType] : [];
        const missingOperator = !rule.operator || !operators.includes(rule.operator);
        const missingValue = !rule.value.trim();
        const isListOperator = rule.operator === "IN_LIST" || rule.operator === "NOT_IN_LIST";
        const listParts = rule.value.split(";").map((item) => item.trim());
        const invalidListFormat =
          isListOperator &&
          !missingValue &&
          !(listParts.length >= 2 && listParts.every((item) => item.length > 0));

        const invalidBooleanValue =
          field?.fieldType === "boolean" &&
          !missingValue &&
          rule.value !== "true" &&
          rule.value !== "false";

        const invalidNumericValue =
          field?.fieldType === "numeric" &&
          !missingValue &&
          !/^-?\d+(\.\d+)?$/.test(rule.value.trim());

        const invalidDateValue =
          field?.fieldType === "date" &&
          !missingValue &&
          !/^\d{4}-\d{2}-\d{2}$/.test(rule.value.trim());

        return {
          missingOperator,
          missingValue,
          invalidListFormat,
          invalidBooleanValue,
          invalidNumericValue,
          invalidDateValue
        };
      }),
    [fields, rules]
  );

  const hasValidationErrors = validationErrors.some(
    (item) =>
      item.missingOperator ||
      item.missingValue ||
      item.invalidListFormat ||
      item.invalidBooleanValue ||
        item.invalidNumericValue ||
        item.invalidDateValue
  );

  function getFieldForRule(rule: NumeratorRuleExpressionDto): NumeratorModelFieldDto | undefined {
    return fields.find((f) => f.applicationModelFieldId === rule.applicationModelId);
  }

  function updateRule(index: number, updates: Partial<NumeratorRuleExpressionDto>): void {
    if (showValidation) {
      setShowValidation(false);
    }

    const updatedRules = [...rules];
    updatedRules[index] = { ...updatedRules[index], ...updates };
    onUpdateRules(updatedRules);
  }

  function moveRule(index: number, direction: number): void {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= rules.length) return;

    const updatedRules = [...rules];
    [updatedRules[index], updatedRules[newIndex]] = [updatedRules[newIndex], updatedRules[index]];
    onUpdateRules(updatedRules);
  }

  function removeRule(index: number): void {
    const updatedRules = rules.filter((_, i) => i !== index);
    onUpdateRules(updatedRules);
  }

  function addRule(): void {
    if (filterableFields.length === 0) return;
    onUpdateRules([
      ...rules,
      {
        applicationModelId: filterableFields[0].applicationModelFieldId,
        operator: "",
        value: ""
      }
    ]);
  }

  return (
    <section className="card">
      <div>
        <h3>Edit Filter Rules</h3>

        {rules.length === 0 && <p>No rules. Click "Add Rule" to create one.</p>}

        {rules.map((rule, index) => {
          const field = getFieldForRule(rule);
          const operators = field?.fieldType ? NUMERATOR_OPERATORS_BY_TYPE[field.fieldType] : [];

          return (
            <div key={index} style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
              <span>{index + 1}.</span>

              <select className="form-input"
                value={rule.applicationModelId}
                onChange={(e) => {
                  const nextModelId = e.target.value;
                  const nextField = fields.find((f) => f.applicationModelFieldId === nextModelId);
                  const nextOperators = nextField?.fieldType ? NUMERATOR_OPERATORS_BY_TYPE[nextField.fieldType] : [];
                  const nextOperator = nextOperators.includes(rule.operator) ? rule.operator : "";

                  updateRule(index, { applicationModelId: nextModelId, operator: nextOperator });
                }}
              >
                {filterableFields.map((f) => (
                  <option key={f.applicationModelFieldId} value={f.applicationModelFieldId}>
                    {f.fieldName} ({f.fieldType})
                  </option>
                ))}
              </select>

              <select className="form-input"
                value={rule.operator}
                onChange={(e) => updateRule(index, { operator: e.target.value })}
                aria-invalid={showValidation && validationErrors[index].missingOperator}
              >
                <option value="">Select operator</option>
                {operators.map((op) => (
                  <option key={op} value={op}>
                    {NUMERATOR_OPERATOR_LABELS[op] || op}
                  </option>
                ))}
              </select>

              <input 
                className="form-input"
                type="text"
                value={rule.value}
                onChange={(e) => updateRule(index, { value: e.target.value })}
                placeholder={
                  field?.fieldType === "boolean"
                    ? "true or false"
                    : field?.fieldType === "numeric"
                      ? "e.g. 42 or 3.14"
                      : field?.fieldType === "date"
                        ? "YYYY-MM-DD"
                      : rule.operator === "IN_LIST" || rule.operator === "NOT_IN_LIST"
                        ? "Value1;Value2"
                        : "Value"
                }
                aria-invalid={
                  showValidation &&
                  (validationErrors[index].missingValue ||
                    validationErrors[index].invalidListFormat ||
                    validationErrors[index].invalidBooleanValue ||
                    validationErrors[index].invalidNumericValue ||
                    validationErrors[index].invalidDateValue)
                }
              />

              {showValidation &&
                (validationErrors[index].missingOperator ||
                  validationErrors[index].missingValue ||
                  validationErrors[index].invalidListFormat ||
                  validationErrors[index].invalidBooleanValue ||
                  validationErrors[index].invalidNumericValue ||
                  validationErrors[index].invalidDateValue) && (
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
                className="btn btn--destructive filter-rule-btn"
                onClick={() => removeRule(index)}
                aria-label={`Remove rule ${index + 1}`}
              >
                <span aria-hidden="true">🗑</span>
                Remove
              </button>
            </div>
          );
        })}

        {showValidation && hasValidationErrors && (
          <div className="admin-alert" role="alert" style={{ marginTop: "0.5rem", fontSize: "1rem" }}>
            Complete each rule with an operator and a valid value. Boolean fields accept only &apos;true&apos; or &apos;false&apos;. Numeric
            fields accept only numbers. Date fields must use YYYY-MM-DD. IN_LIST and NOT_IN_LIST require semicolon-separated values.
          </div>
        )}

        <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
          <button
            type="button"
            className="filter-rule-btn filter-rule-btn-add"
            onClick={addRule}
            disabled={filterableFields.length === 0}
          >
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
            {saving ? <Spinner size="sm" label="Saving…" inline /> : "Save"}
          </button>
          <button
            type="button"
            className="filter-rule-btn filter-rule-btn-cancel"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      </div>
    </section>
  );
}