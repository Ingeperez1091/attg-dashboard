import { NumeratorModelFieldDto } from "@/core/application/dto/numerator/NumeratorFilterDto";

type ApplicationModelFieldsProps = {
  fields: NumeratorModelFieldDto[];
};

export function ApplicationModelFields({ fields }: ApplicationModelFieldsProps) {
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
          <tr key={field.applicationModelFieldId}>
            <td>{field.fieldName}</td>
            <td>{field.fieldType}</td>
            <td>{field.isFilterable ? "Yes" : "No"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
