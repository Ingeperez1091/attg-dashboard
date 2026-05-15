import { ReactElement } from "react";
import { ValidationSummaryDto } from "@/core/application/services/validationPipelineService";

interface ValidationSummaryProps {
  errors: string[];
  title?: string;
}

/**
 * Renders a red error summary box when there are validation errors.
 * Returns null when the errors array is empty.
 */
export function ValidationSummary({
  errors,
  title = "Please fix the following errors:",
}: ValidationSummaryProps): ReactElement | null {
  if (errors.length === 0) return null;

  return (
    <div className="validation-summary" role="alert">
      <p className="validation-summary__title">{title}</p>
      <ul className="validation-summary__list">
        {errors.map((err, i) => (
          <li key={i}>{err}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Renders a pipeline-run validation summary card with status counts and
 * grouped error breakdown.  Returns null when no run data is available.
 */
export function PipelineValidationSummary({
  summary,
  appId,
  runId,
}: {
  summary: ValidationSummaryDto | null;
  appId: string;
  runId?: string;
}): ReactElement | null {
  if (!summary?.summary) return null;

  const { totalRecords, validCount, invalidCount, duplicateCount, filteredOutCount, matchedCount } =
    summary.summary;

  const hasErrors = invalidCount > 0 || duplicateCount > 0 || filteredOutCount > 0;

  return (
    <div className="card">
      <h2 className="card__title">
        Validation Results
        {summary.applicationName ? ` — ${summary.applicationName}` : ""}
      </h2>

      {summary.runDate && (
        <p className="card__subtitle" style={{ fontSize: "0.8rem", color: "var(--app-text-secondary)" }}>
          Run: {summary.runId ?? "—"} · {new Date(summary.runDate).toLocaleString()}
        </p>
      )}

      <div className="card-grid" style={{ marginTop: "1rem" }}>
        <div className="stat-card">
          <span className="stat-card__label">Total In</span>
          <span className="stat-card__value">{totalRecords}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">Valid</span>
          <span className="stat-card__value" style={{ color: "var(--color-success, green)" }}>{validCount}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">Matched</span>
          <span className="stat-card__value">{matchedCount}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">Invalid</span>
          <span className="stat-card__value" style={{ color: invalidCount > 0 ? "var(--color-error, red)" : undefined }}>
            {invalidCount}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">Duplicates</span>
          <span className="stat-card__value" style={{ color: duplicateCount > 0 ? "var(--color-warning, orange)" : undefined }}>
            {duplicateCount}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">Filtered Out</span>
          <span className="stat-card__value" style={{ color: filteredOutCount > 0 ? "var(--color-warning, orange)" : undefined }}>
            {filteredOutCount}
          </span>
        </div>
      </div>

      {hasErrors && summary.errorBreakdown.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <h3 className="card__subtitle">Error Breakdown</h3>
          <ul className="validation-summary__list" style={{ marginTop: "0.5rem" }}>
            {summary.errorBreakdown.map((entry, i) => (
              <li key={i}>
                <strong>{entry.count}</strong> — {entry.errorType}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="form-actions" style={{ marginTop: "1rem" }}>
        <a
          href={`/validation-results/${appId}${runId ? `?runId=${runId}` : ""}`}
          className="btn btn--secondary"
        >
          View All Results
        </a>
      </div>
    </div>
  );
}
