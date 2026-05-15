import { DenominatorModelField } from "@/core/domain/entities/DenominatorFilter";
import { IDenominatorModelRepository } from "@/core/domain/repositories/IDenominatorModelRepository";
import { listDenominatorModelFields } from "@/infrastructure/persistence/database/queries/denominator-model-queries";
import { SqlClient } from "@/lib/db/sql-client";

function toSqlBit(value: boolean | number): boolean {
  return value === true || value === 1;
}

export class DenominatorModelDbRepository implements IDenominatorModelRepository {
  constructor(private readonly sqlClient: SqlClient) {}

  async getFields(): Promise<DenominatorModelField[]> {
    const rows = await listDenominatorModelFields(this.sqlClient);
    return rows.map((row) => ({
      denominatorModelId: row.DenominatorModelId,
      fieldName: row.FieldName,
      fieldType: row.FieldType,
      sourceColumn: row.SourceColumn,
      isFilterable: toSqlBit(row.IsFilterable),
      displayOrder: row.DisplayOrder,
      isActive: toSqlBit(row.IsActive)
    }));
  }

  async getFilterableFields(): Promise<DenominatorModelField[]> {
    const rows = await this.getFields();
    return rows.filter((field) => field.isFilterable && field.isActive);
  }

  async getNumericFields(): Promise<DenominatorModelField[]> {
    const rows = await this.getFields();
    return rows.filter((field) => field.fieldType === "numeric" && field.isActive);
  }

  async getFieldById(denominatorModelId: string): Promise<DenominatorModelField | null> {
    const rows = await this.getFields();
    return rows.find((field) => field.denominatorModelId === denominatorModelId) ?? null;
  }
}
