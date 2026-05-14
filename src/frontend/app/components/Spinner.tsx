import { ReactElement } from "react";

type SpinnerSize = "sm" | "md" | "lg";

interface SpinnerProps {
  size?: SpinnerSize;
  label?: string;
  /** Render as an inline token (e.g. inside a button) */
  inline?: boolean;
}

/**
 * Reusable loading spinner.
 * Sizes: sm (16px), md (28px), lg (44px).
 * Uses `.spinner*` utilities from global.css.
 */
export function Spinner({ size = "md", label = "Loading…", inline }: SpinnerProps): ReactElement {
  if (inline) {
    return (
      <span className="spinner-inline">
        <span className={`spinner spinner-${size}`} aria-hidden="true" />
        <span className="spinner-label">{label}</span>
      </span>
    );
  }

  return (
    <div className="spinner-container" role="status" aria-live="polite">
      <span className={`spinner spinner-${size}`} aria-hidden="true" />
      <span className="spinner-label">{label}</span>
    </div>
  );
}
