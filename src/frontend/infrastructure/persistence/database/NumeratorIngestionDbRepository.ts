import { randomUUID } from "node:crypto";
import {
  StageNumeratorPayloadInput,
  StageNumeratorPayloadResult
} from "@/core/domain/entities/NumeratorIngestion";
import { INumeratorIngestionRepository } from "@/core/domain/repositories/INumeratorIngestionRepository";
import { SqlClient } from "@/lib/db/sql-client";
import { insertStagedPayload } from "@/infrastructure/persistence/database/queries/numerator-ingestion-queries";

export class NumeratorIngestionDbRepository implements INumeratorIngestionRepository {
  constructor(private readonly sqlClient: SqlClient) {}

  async stagePayload(input: StageNumeratorPayloadInput): Promise<StageNumeratorPayloadResult> {
    const stageId = randomUUID();

    const row = await insertStagedPayload(this.sqlClient, {
      stageId,
      applicationId: input.applicationId,
      payloadJson: input.payloadJson,
      createdBy: input.createdBy
    });

    return {
      stageId: row?.StageId ?? stageId,
      applicationId: row?.ApplicationId ?? input.applicationId,
      payloadJson: row?.PayloadJson ?? input.payloadJson,
      createdBy: row?.CreatedBy ?? input.createdBy,
      createDate: new Date(row?.CreateDate ?? Date.now()).toISOString()
    };
  }
}
