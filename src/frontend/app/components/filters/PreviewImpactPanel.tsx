"use client";

import { PreviewMetrics, PreviewResult, PreviewState } from "./hooks/usePreviewSSE";

const STAGE_LABELS: Record<string, string> = {
  queued: "Queuing pipeline run…",
  processing: "Processing records…",
  filtering_denominator: "Filtering denominator…",
  matching_numerator: "Matching numerator records…",
  calculating_metrics: "Calculating metrics…",
};

interface PreviewImpactPanelProps {
  state: PreviewState;
  onRetry: () => void;
  disabled?: boolean;
}

function DeltaIndicator({ value }: Readonly<{ value: number }>) {
  if (value > 0) return <span className="delta delta--up" aria-label="increased">▲ +{formatMetric(value)}</span>;
  if (value < 0) return <span className="delta delta--down" aria-label="decreased">▼ {formatMetric(value)}</span>;
  return <span className="delta delta--same" aria-label="unchanged">— 0</span>;
}

function formatMetric(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return value.toLocaleString();
  }
  if (Number.isInteger(value)) {
    return value.toLocaleString();
  }
  return value.toFixed(2);
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatRevenue(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function MetricRow({
  label,
  current,
  projected,
  delta,
  formatter,
}: Readonly<{
  label: string;
  current: number;
  projected: number;
  delta: number;
  formatter: (v: number) => string;
}>) {
  return (
    <tr>
      <td className="metric-label">{label}</td>
      <td className="metric-value">{formatter(current)}</td>
      <td className="metric-value">{formatter(projected)}</td>
      <td className="metric-delta">
        <DeltaIndicator value={delta} />
      </td>
    </tr>
  );
}

function ComparisonTable({ result }: Readonly<{ result: PreviewResult }>) {
  const rows: {
    label: string;
    key: keyof PreviewMetrics;
    formatter: (v: number) => string;
  }[] = [
    { label: "Adoption %", key: "adoptionPct", formatter: formatPct },
    { label: "Revenue Share %", key: "revenueSharePct", formatter: formatPct },
    { label: "Matched Count", key: "matchedCount", formatter: (v) => v.toLocaleString() },
    { label: "Denominator Count", key: "denominatorCount", formatter: (v) => v.toLocaleString() },
    { label: "Denominator Revenue", key: "denominatorRevenue", formatter: formatRevenue },
  ];

  return (
    <div className="table-scroll-wrap">
      <table className="preview-comparison-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th>Current</th>
            <th>Projected</th>
            <th>Delta</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <MetricRow
              key={row.key}
              label={row.label}
              current={result.current[row.key]}
              projected={result.projected[row.key]}
              delta={result.delta[row.key]}
              formatter={row.formatter}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PreviewImpactPanel({
  state,
  onRetry,
  disabled,
}: Readonly<PreviewImpactPanelProps>) {
  if (state.status === "idle") {
    return (
      <section className="preview-impact" data-testid="preview-impact-panel-idle">
        <p className="preview-impact__hint">
          {disabled
            ? "Make changes to rules before previewing impact."
            : "Click \"Preview Impact\" to compare current vs. projected metrics."}
        </p>
      </section>
    );
  }

  if (state.status === "streaming") {
    const stageLabel = STAGE_LABELS[state.progress.stage] ?? "Processing…";
    return (
      <section className="preview-impact preview-impact--loading" data-testid="preview-impact-panel">
        <div className="preview-impact__progress">
          <div
            className="preview-impact__progress-bar"
            role="progressbar"
            aria-valuenow={state.progress.pctComplete}
            aria-valuemin={0}
            aria-valuemax={100}
            style={{ width: `${state.progress.pctComplete}%` }}
          />
        </div>
        <p className="preview-impact__stage">{stageLabel}</p>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="preview-impact preview-impact--error" data-testid="preview-impact-panel">
        <p className="admin-alert" role="alert">{state.message}</p>
        <button type="button" className="btn btn--secondary" onClick={onRetry}>
          Retry
        </button>
      </section>
    );
  }

  // state.status === "complete"
  const { result } = state;
  return (
    <section className="preview-impact preview-impact--complete" data-testid="preview-impact-panel">
      <h3 className="preview-impact__title">Impact Preview Results</h3>

      <ComparisonTable result={result} />

      {result.warnings.length > 0 && (
        <div className="preview-impact__warnings" role="alert">
          {result.warnings.map((warning, i) => (
            <p key={i} className="preview-impact__warning">{warning}</p>
          ))}
        </div>
      )}

      {result.projected.denominatorCount === 0 && (
        <p className="admin-alert" role="alert" style={{ marginTop: "0.75rem" }}>
          Warning: projected denominator is empty — all records would be excluded.
        </p>
      )}

      <p className="preview-impact__meta">
        Calculated at: {new Date(result.calculatedAtUtc).toLocaleString()}
      </p>
    </section>
  );
}
