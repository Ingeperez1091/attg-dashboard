import { Spinner } from "@/app/components/Spinner";
import { resolveUserDisplayName, UserDirectoryEntry } from "@/app/components/hooks/useUserAuditMetadata";
import { DenominatorRuleViewDto } from "@/core/application/dto/denominator/DenominatorFilterDto";

type DenominatorRuleListProps = {
  rules: DenominatorRuleViewDto[];
  loading?: boolean;
  lastUpdatedAt?: string | null;
  lastUpdatedBy?: string | null;
  userDirectory?: UserDirectoryEntry[];
};

export function DenominatorRuleList({
  rules,
  loading,
  lastUpdatedAt,
  lastUpdatedBy,
  userDirectory = []
}: DenominatorRuleListProps) {
  if (loading) {
    return <Spinner size="md" label="Loading denominator rules..." />;
  }

  if (rules.length === 0) {
    return <p>No denominator rules configured for this application.</p>;
  }

  const displayName = lastUpdatedBy ? resolveUserDisplayName(lastUpdatedBy, userDirectory) : "Unknown";

  return (
    <section className="card">
      <h2 className="card__title">Denominator Rules</h2>
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
