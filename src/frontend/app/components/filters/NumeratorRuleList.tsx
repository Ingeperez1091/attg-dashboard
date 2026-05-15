import { Spinner } from "@/app/components/Spinner";
import { resolveUserDisplayName, UserDirectoryEntry } from "@/app/components/hooks/useUserAuditMetadata";
import { NumeratorRuleViewDto } from "@/core/application/dto/numerator/NumeratorFilterDto";

type NumeratorRuleListProps = {
  rules: NumeratorRuleViewDto[];
  loading?: boolean;
  lastUpdatedAt?: string | null;
  lastUpdatedBy?: string | null;
  userDirectory?: UserDirectoryEntry[];
};

export function NumeratorRuleList({ rules, loading, lastUpdatedAt, lastUpdatedBy, userDirectory = [] }: NumeratorRuleListProps) {
  if (loading) {
    return <Spinner size="md" label="Loading rules…" />;
  }

  if (rules.length === 0) {
    return <p>No rules. Click "Add Rule" to create one.</p>;
  }

  const displayName = lastUpdatedBy ? resolveUserDisplayName(lastUpdatedBy, userDirectory) : "Unknown";

  return (
    <section className="card">
      <h2 className="card__title">Numerator Rules</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Field</th>
            <th>Type</th>
            <th>Operator</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => (
            <tr key={rule.ruleId}>
              <td>{rule.ruleOrder}</td>
              <td>{rule.fieldName}</td>
              <td>{rule.fieldType}</td>
              <td>{rule.operator}</td>
              <td>{rule.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {lastUpdatedAt && (
        <p>
          Last updated: {new Date(lastUpdatedAt).toLocaleString()} by {displayName}
        </p>
      )}
    </section>
  );
}