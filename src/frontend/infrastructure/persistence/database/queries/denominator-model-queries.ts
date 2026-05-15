import { executeParameterizedQuery, SqlClient } from "@/lib/db/sql-client";

export interface DenominatorModelFieldRow {
  DenominatorModelId: string;
  FieldName: string;
  FieldType: "text" | "numeric" | "date";
  SourceColumn: string;
  IsFilterable: boolean | number;
  DisplayOrder: number;
  IsActive: boolean | number;
}

export async function listDenominatorModelFields(client: SqlClient): Promise<DenominatorModelFieldRow[]> {
  const sql = `
    SELECT
      DenominatorModelId,
      FieldName,
      FieldType,
      SourceColumn,
      IsFilterable,
      DisplayOrder,
      IsActive
    FROM app.DenominatorModels
    WHERE IsActive = 1
    ORDER BY DisplayOrder ASC, DenominatorModelId ASC;
  `;

  const result = await executeParameterizedQuery<DenominatorModelFieldRow>(client, sql, {});
  return result.rows;
}
