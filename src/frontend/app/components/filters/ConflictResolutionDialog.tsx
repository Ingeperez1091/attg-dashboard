"use client";

import { useState } from "react";
import { DENOMINATOR_OPERATOR_LABELS } from "@/core/application/dto/denominator/DenominatorFilterDto";

export interface ConflictDetails {
  currentVersion: number;
  currentRules: unknown[];
  lastModifiedBy: string;
  lastModifiedByName?: string;
  lastModifiedAt: string;
}

export interface FieldLookupEntry {
  denominatorModelId: string;
  fieldName: string;
}

export interface ConflictResolutionDialogProps {
  open: boolean;
  conflict: ConflictDetails;
  userRules: unknown[];
  fieldLookup?: FieldLookupEntry[];
  isAdmin: boolean;
  onReload: () => void;
  onForceSave: (reason: string) => void;
  onCancel: () => void;
}

interface NormalizedRule {
  fieldName: string;
  operator: string;
  value: string;
}

function formatOperator(op: string): string {
  return DENOMINATOR_OPERATOR_LABELS[op] ?? op;
}

function getStringField(rule: Record<string, unknown>, key: string): string {
  const val = rule[key] ?? rule[key.charAt(0).toUpperCase() + key.slice(1)];
  if (val === null || val === undefined) return "";
  return typeof val === "string" ? val : JSON.stringify(val);
}

function resolveFieldName(
  denominatorModelId: string | undefined,
  fieldName: string | undefined,
  lookup: FieldLookupEntry[]
): string {
  if (fieldName) return fieldName;
  if (!denominatorModelId) return "Unknown field";
  const match = lookup.find((f) => f.denominatorModelId === denominatorModelId);
  return match?.fieldName ?? denominatorModelId;
}

function normalizeRules(
  rules: unknown[],
  lookup: FieldLookupEntry[]
): NormalizedRule[] {
  return rules.map((r) => {
    const rule = r as Record<string, unknown>;
    const modelId = getStringField(rule, "denominatorModelId") || undefined;
    const name = getStringField(rule, "fieldName") || undefined;
    return {
      fieldName: resolveFieldName(modelId, name, lookup),
      operator: getStringField(rule, "operator"),
      value: getStringField(rule, "value"),
    };
  });
}

function buildDiffRows(
  serverRules: NormalizedRule[],
  userRules: NormalizedRule[]
): { fieldName: string; serverValue: string; userValue: string; changed: boolean }[] {
  const allFields = new Map<string, { server: string; user: string }>();

  for (const r of serverRules) {
    const existing = allFields.get(r.fieldName);
    if (existing) {
      existing.server = `${formatOperator(r.operator)} ${r.value}`;
    } else {
      allFields.set(r.fieldName, {
        server: `${formatOperator(r.operator)} ${r.value}`,
        user: "",
      });
    }
  }

  for (const r of userRules) {
    const existing = allFields.get(r.fieldName);
    if (existing) {
      existing.user = `${formatOperator(r.operator)} ${r.value}`;
    } else {
      allFields.set(r.fieldName, {
        server: "",
        user: `${formatOperator(r.operator)} ${r.value}`,
      });
    }
  }

  return Array.from(allFields.entries()).map(([fieldName, vals]) => ({
    fieldName,
    serverValue: vals.server,
    userValue: vals.user,
    changed: vals.server !== vals.user,
  }));
}

export function ConflictResolutionDialog({
  open,
  conflict,
  userRules,
  fieldLookup = [],
  isAdmin,
  onReload,
  onForceSave,
  onCancel,
}: Readonly<ConflictResolutionDialogProps>) {
  const [showForceForm, setShowForceForm] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);

  if (!open) return null;

  function handleForceSaveClick() {
    setShowForceForm(true);
    setReasonError(null);
  }

  function handleConfirmForceSave() {
    const trimmed = overrideReason.trim();
    if (!trimmed) {
      setReasonError("A reason is required to force-save.");
      return;
    }
    onForceSave(trimmed);
  }

  function handleCancel() {
    setShowForceForm(false);
    setOverrideReason("");
    setReasonError(null);
    onCancel();
  }

  const modifiedDate = new Date(conflict.lastModifiedAt).toLocaleString();
  const serverNormalized = normalizeRules(conflict.currentRules, fieldLookup);
  const userNormalized = normalizeRules(userRules, fieldLookup);
  const diffRows = buildDiffRows(serverNormalized, userNormalized);
  const hasChanges = diffRows.some((row) => row.changed);

  return (
    <dialog
      className="dialog-overlay"
      aria-label="Version conflict"
      open={true}
    >
      <div className="dialog-panel conflict-dialog">
        <div className="conflict-dialog__header">
          <span className="conflict-dialog__icon" aria-hidden="true">&#9888;</span>
          <h2 className="conflict-dialog__title">Version Conflict</h2>
        </div>
        <p className="conflict-dialog__message">
          This configuration was saved by <strong>{conflict.lastModifiedByName ?? conflict.lastModifiedBy}</strong> on{" "}
          <strong>{modifiedDate}</strong> (version {conflict.currentVersion}).
          Review the differences below.
        </p>

        <div className="conflict-dialog__comparison">
          <table className="conflict-dialog__table" aria-label="Rule comparison">
            <thead>
              <tr>
                <th>Field</th>
                <th>Server Value</th>
                <th>Your Value</th>
              </tr>
            </thead>
            <tbody>
              {diffRows.length === 0 && (
                <tr>
                  <td colSpan={3} className="conflict-dialog__empty">
                    No rules to compare.
                  </td>
                </tr>
              )}
              {diffRows.map((row) => (
                <tr
                  key={row.fieldName}
                  className={row.changed ? "conflict-dialog__row--changed" : ""}
                >
                  <td className="conflict-dialog__cell-field">{row.fieldName}</td>
                  <td className="conflict-dialog__cell-value">
                    {row.serverValue || <span className="conflict-dialog__absent">(not set)</span>}
                  </td>
                  <td className="conflict-dialog__cell-value">
                    {row.userValue || <span className="conflict-dialog__absent">(not set)</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {hasChanges && (
            <p className="conflict-dialog__hint">
              Highlighted rows indicate differences between server and your changes.
            </p>
          )}
        </div>

        {showForceForm && (
          <div className="conflict-dialog__force-form">
            <label htmlFor="override-reason" className="conflict-dialog__label">
              Override reason (required)
            </label>
            <textarea
              id="override-reason"
              className="conflict-dialog__textarea"
              value={overrideReason}
              onChange={(e) => {
                setOverrideReason(e.target.value);
                if (reasonError) setReasonError(null);
              }}
              placeholder="Explain why you need to force-save over the current version..."
              rows={3}
            />
            {reasonError && (
              <p className="conflict-dialog__error">{reasonError}</p>
            )}
          </div>
        )}

        <div className="conflict-dialog__actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={onReload}
          >
            Reload &amp; Re-Edit
          </button>

          <div className="conflict-dialog__actions-spacer" />

          {isAdmin && !showForceForm && (
            <button
              type="button"
              className="btn btn--warning"
              onClick={handleForceSaveClick}
            >
              Force-Save (Admin Only)
            </button>
          )}

          {isAdmin && showForceForm && (
            <button
              type="button"
              className="btn btn--warning"
              onClick={handleConfirmForceSave}
            >
              Confirm Force-Save
            </button>
          )}

          <button
            type="button"
            className="btn btn--secondary"
            onClick={handleCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </dialog>
  );
}
