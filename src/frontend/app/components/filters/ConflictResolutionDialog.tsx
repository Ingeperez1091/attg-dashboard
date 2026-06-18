"use client";

import { useState } from "react";

export interface ConflictDetails {
  currentVersion: number;
  currentRules: unknown[];
  lastModifiedBy: string;
  lastModifiedAt: string;
}

export interface ConflictResolutionDialogProps {
  open: boolean;
  conflict: ConflictDetails;
  userRules: unknown[];
  isAdmin: boolean;
  onReload: () => void;
  onForceSave: (reason: string) => void;
  onCancel: () => void;
}

export function ConflictResolutionDialog({
  open,
  conflict,
  userRules,
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

  return (
    <dialog
      className="dialog-overlay"
      aria-label="Version conflict"
      open={true}
    >
      <div className="dialog-panel conflict-dialog">
        <h2 className="conflict-dialog__title">Version Conflict</h2>
        <p className="conflict-dialog__message">
          Configuration was modified by another user since you loaded it.
        </p>

        <div className="conflict-dialog__details">
          <div className="conflict-dialog__section">
            <h3>Latest Saved Version</h3>
            <dl className="conflict-dialog__meta">
              <dt>Modified by</dt>
              <dd>{conflict.lastModifiedBy}</dd>
              <dt>Modified at</dt>
              <dd>{modifiedDate}</dd>
              <dt>Version</dt>
              <dd>{conflict.currentVersion}</dd>
            </dl>
            <details className="conflict-dialog__rules-detail">
              <summary>
                Server rules ({conflict.currentRules.length} rule
                {conflict.currentRules.length === 1 ? "" : "s"})
              </summary>
              <pre className="conflict-dialog__rules-json">
                {JSON.stringify(conflict.currentRules, null, 2)}
              </pre>
            </details>
          </div>

          <div className="conflict-dialog__section">
            <h3>Your Unsaved Changes</h3>
            <details className="conflict-dialog__rules-detail">
              <summary>
                Your rules ({userRules.length} rule
                {userRules.length === 1 ? "" : "s"})
              </summary>
              <pre className="conflict-dialog__rules-json">
                {JSON.stringify(userRules, null, 2)}
              </pre>
            </details>
          </div>
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
            Reload &amp; re-edit
          </button>

          {isAdmin && !showForceForm && (
            <button
              type="button"
              className="btn btn--warning"
              onClick={handleForceSaveClick}
            >
              Force-save (admin)
            </button>
          )}

          {isAdmin && showForceForm && (
            <button
              type="button"
              className="btn btn--warning"
              onClick={handleConfirmForceSave}
            >
              Confirm force-save
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
