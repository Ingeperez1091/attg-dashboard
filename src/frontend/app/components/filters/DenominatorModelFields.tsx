import { DenominatorModelFieldDto } from "@/core/application/dto/denominator/DenominatorFilterDto";

type DenominatorModelFieldsProps = {
  fields: DenominatorModelFieldDto[];
};

export function DenominatorModelFields({ fields }: DenominatorModelFieldsProps) {
  if (fields.length === 0) {
    return <p>No fields available.</p>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Field Name</th>
          <th>Type</th>
          <th>Filterable</th>
        </tr>
      </thead>
      <tbody>
        {fields.map((field) => (
          <tr key={field.denominatorModelId}>
            <td>{field.fieldName}</td>
            <td>{field.fieldType}</td>
            <td>{field.isFilterable ? "Yes" : "No"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
