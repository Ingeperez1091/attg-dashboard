import { StageNumeratorPayloadInput, StageNumeratorPayloadResult } from "@/core/domain/entities/NumeratorIngestion";

export interface INumeratorIngestionRepository {
  stagePayload(input: StageNumeratorPayloadInput): Promise<StageNumeratorPayloadResult>;
}
