import { DenominatorModelField } from "@/core/domain/entities/DenominatorFilter";
import { IDenominatorModelRepository } from "@/core/domain/repositories/IDenominatorModelRepository";

const MODEL_FIELDS: DenominatorModelField[] = [
  { denominatorModelId: "50000000-0000-0000-0001-000000000000", fieldName: "EngagementID", fieldType: "text", sourceColumn: "[EngagementID]", isFilterable: false, displayOrder: 1, isActive: true },
  { denominatorModelId: "50000000-0000-0000-0002-000000000000", fieldName: "Engagement", fieldType: "text", sourceColumn: "[Engagement]", isFilterable: true, displayOrder: 2, isActive: true },
  { denominatorModelId: "50000000-0000-0000-0003-000000000000", fieldName: "ClientID", fieldType: "text", sourceColumn: "[ClientID]", isFilterable: false, displayOrder: 3, isActive: true },
  { denominatorModelId: "50000000-0000-0000-0004-000000000000", fieldName: "Client", fieldType: "text", sourceColumn: "[Client]", isFilterable: true, displayOrder: 4, isActive: true },
  { denominatorModelId: "50000000-0000-0000-0005-000000000000", fieldName: "AccountChannel", fieldType: "text", sourceColumn: "[AccountChannel]", isFilterable: true, displayOrder: 5, isActive: true },
  { denominatorModelId: "50000000-0000-0000-0006-000000000000", fieldName: "EngagementSubServiceLine", fieldType: "text", sourceColumn: "[EngagementSubServiceLine]", isFilterable: true, displayOrder: 6, isActive: true },
  { denominatorModelId: "50000000-0000-0000-0007-000000000000", fieldName: "EngagementServiceCode", fieldType: "text", sourceColumn: "[EngagementServiceCode]", isFilterable: true, displayOrder: 7, isActive: true },
  { denominatorModelId: "50000000-0000-0000-0008-000000000000", fieldName: "EngagementService", fieldType: "text", sourceColumn: "[EngagementService]", isFilterable: false, displayOrder: 8, isActive: true },
  { denominatorModelId: "50000000-0000-0000-0009-000000000000", fieldName: "EngagementStatus", fieldType: "text", sourceColumn: "[EngagementStatus]", isFilterable: true, displayOrder: 9, isActive: true },
  { denominatorModelId: "50000000-0000-0000-000A-000000000000", fieldName: "CreationDate", fieldType: "date", sourceColumn: "[CreationDate]", isFilterable: true, displayOrder: 10, isActive: true },
  { denominatorModelId: "50000000-0000-0000-000B-000000000000", fieldName: "ReleaseDate", fieldType: "date", sourceColumn: "[ReleaseDate]", isFilterable: true, displayOrder: 11, isActive: true },
  { denominatorModelId: "50000000-0000-0000-000C-000000000000", fieldName: "ETD_ANSRAmt", fieldType: "numeric", sourceColumn: "[ETD_ANSRAmt]", isFilterable: true, displayOrder: 12, isActive: true },
  { denominatorModelId: "50000000-0000-0000-000D-000000000000", fieldName: "FYTD_ANSRAmt", fieldType: "numeric", sourceColumn: "[FYTD_ANSRAmt]", isFilterable: true, displayOrder: 13, isActive: true },
  { denominatorModelId: "50000000-0000-0000-000E-000000000000", fieldName: "ETD_TERAmt", fieldType: "numeric", sourceColumn: "[ETD_TERAmt]", isFilterable: true, displayOrder: 14, isActive: true },
  { denominatorModelId: "50000000-0000-0000-000F-000000000000", fieldName: "FYTD_TERAmt", fieldType: "numeric", sourceColumn: "[FYTD_TERAmt]", isFilterable: true, displayOrder: 15, isActive: true },
  { denominatorModelId: "50000000-0000-0000-0010-000000000000", fieldName: "ETD_ChargedHours", fieldType: "numeric", sourceColumn: "[ETD_ChargedHours]", isFilterable: false, displayOrder: 16, isActive: true },
  { denominatorModelId: "50000000-0000-0000-0011-000000000000", fieldName: "FYTD_ChargedHours", fieldType: "numeric", sourceColumn: "[FYTD_ChargedHours]", isFilterable: false, displayOrder: 17, isActive: true }
];

export class DenominatorModelMemoryRepository implements IDenominatorModelRepository {
  async getFields(): Promise<DenominatorModelField[]> {
    return [...MODEL_FIELDS].sort((a, b) => a.displayOrder - b.displayOrder);
  }

  async getFilterableFields(): Promise<DenominatorModelField[]> {
    return MODEL_FIELDS.filter((field) => field.isActive && field.isFilterable);
  }

  async getNumericFields(): Promise<DenominatorModelField[]> {
    return MODEL_FIELDS.filter((field) => field.isActive && field.fieldType === "numeric");
  }

  async getFieldById(denominatorModelId: string): Promise<DenominatorModelField | null> {
    return MODEL_FIELDS.find((field) => field.denominatorModelId === denominatorModelId) ?? null;
  }
}
