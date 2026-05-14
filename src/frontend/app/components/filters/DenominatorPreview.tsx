import { DenominatorPreviewResultDto } from "@/core/application/dto/denominator/DenominatorFilterDto";

type DenominatorPreviewProps = {
  preview: DenominatorPreviewResultDto | null;
  loading?: boolean;
  error?: string | null;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(value);
}

export function DenominatorPreview({ preview, loading, error }: DenominatorPreviewProps) {
  return (
    <section className="card" style={{ marginTop: "16px" }}>
      <h2 className="card__title">Preview Impact</h2>

      {loading && <p>Calculating preview...</p>}
      {error && !loading && <p className="admin-alert">{error}</p>}
      {!loading && !error && !preview && <p>Click Preview to compare current and projected denominator impact.</p>}

      {!loading && !error && preview && (
        <>
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                <th>Current</th>
                <th>Projected</th>
                <th>Delta</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Count</td>
                <td>{preview.current.count.toLocaleString()}</td>
                <td>{preview.projected.count.toLocaleString()}</td>
                <td>{preview.delta.count.toLocaleString()}</td>
              </tr>
              <tr>
                <td>Revenue</td>
                <td>{formatCurrency(preview.current.revenue)}</td>
                <td>{formatCurrency(preview.projected.revenue)}</td>
                <td>{formatCurrency(preview.delta.revenue)}</td>
              </tr>
            </tbody>
          </table>

          {preview.projected.count === 0 && (
            <p className="admin-alert" role="alert" style={{ marginTop: "0.75rem" }}>
              Warning: preview indicates zero denominator records.
            </p>
          )}

          <p style={{ marginTop: "0.75rem", fontSize: "0.875rem" }}>
            Calculated at: {new Date(preview.calculatedAtUtc).toLocaleString()}
          </p>
        </>
      )}
    </section>
  );
}
