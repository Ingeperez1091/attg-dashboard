import { DenominatorModelField } from "@/core/domain/entities/DenominatorFilter";

export interface IDenominatorModelRepository {
  getFields(): Promise<DenominatorModelField[]>;
  getFilterableFields(): Promise<DenominatorModelField[]>;
  getNumericFields(): Promise<DenominatorModelField[]>;
  getFieldById(denominatorModelId: string): Promise<DenominatorModelField | null>;
}
