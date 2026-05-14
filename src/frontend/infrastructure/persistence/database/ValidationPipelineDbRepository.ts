import { SqlClient } from "@/lib/db/sql-client";
import {
  IValidationPipelineRepository,
  ValidationResultsPage,
  ValidationResultsQuery
} from "@/core/domain/repositories/IValidationPipelineRepository";
import {
  CreatePipelineRunInput,
  PipelineRun,
  PipelineRunStatus,
  UpdatePipelineRunStatusInput
} from "@/core/domain/entities/PipelineRun";
import { MatchedRecord, UpsertMatchedRecordInput } from "@/core/domain/entities/MatchedRecord";
import { UpsertValidationResultInput } from "@/core/domain/entities/ValidationResult";
import {
  insertPipelineRun,
  MatchedRecordRow,
  PipelineRunRow,
  selectMatchedRecordsByRunId,
  selectPipelineRunById,
  selectValidationResultsPage,
  setPipelineRunSnapshotDate,
  upsertMatchedRecords,
  updatePipelineRunStatus,
  updateRunCounts,
  ValidationResultRow
} from "@/infrastructure/persistence/database/queries/validation-pipeline-queries";

function mapPipelineRun(row: PipelineRunRow): PipelineRun {
  return {
    runId: row.RunId,
    applicationId: row.ApplicationId,
    status: row.Status,
    triggerSource: row.TriggerSource,
    startTime: row.StartTime,
    endTime: row.EndTime,
    totalRecordsIn: row.TotalRecordsIn,
    validCount: row.ValidCount,
    invalidCount: row.InvalidCount,
    duplicateCount: row.DuplicateCount,
    filteredOutCount: row.FilteredOutCount,
    matchedCount: row.MatchedCount,
    errorMessage: row.ErrorMessage,
    snapshotDate: row.SnapshotDate,
    createdBy: row.CreatedBy,
    updatedBy: row.UpdatedBy,
    createDate: row.CreateDate,
    updateDate: row.UpdateDate
  };
}

export class ValidationPipelineDbRepository implements IValidationPipelineRepository {
  constructor(private readonly sqlClient: SqlClient) {}

  async createRun(input: CreatePipelineRunInput): Promise<PipelineRun> {
    const row = await insertPipelineRun(this.sqlClient, {
      runId: input.runId,
      applicationId: input.applicationId,
      triggerSource: input.triggerSource,
      actorUserId: input.actorUserId
    });

    if (!row) {
      throw new Error("Failed to create pipeline run.");
    }

    return mapPipelineRun(row);
  }

  async getRunById(runId: string): Promise<PipelineRun | null> {
    const row = await selectPipelineRunById(this.sqlClient, runId);
    return row ? mapPipelineRun(row) : null;
  }

  async listRunsByApplication(applicationId: string, limit: number): Promise<PipelineRun[]> {
    const result = await this.sqlClient.query<PipelineRunRow>(
      `
        SELECT TOP (@limit) *
        FROM app.PipelineRuns
        WHERE ApplicationId = @applicationId
        ORDER BY CreateDate DESC;
      `,
      { applicationId, limit }
    );

    return result.rows.map(mapPipelineRun);
  }

  async updateRunStatus(input: UpdatePipelineRunStatusInput): Promise<PipelineRun | null> {
    await updatePipelineRunStatus(this.sqlClient, {
      runId: input.runId,
      status: input.status,
      actorUserId: input.actorUserId,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      errorMessage: input.errorMessage ?? null
    });

    return this.getRunById(input.runId);
  }

  async updateRunCounts(
    runId: string,
    actorUserId: string,
    counts: Partial<
      Pick<
        PipelineRun,
        "totalRecordsIn" | "validCount" | "invalidCount" | "duplicateCount" | "filteredOutCount" | "matchedCount"
      >
    >
  ): Promise<void> {
    await updateRunCounts(this.sqlClient, {
      runId,
      actorUserId,
      totalRecordsIn: counts.totalRecordsIn ?? null,
      validCount: counts.validCount ?? null,
      invalidCount: counts.invalidCount ?? null,
      duplicateCount: counts.duplicateCount ?? null,
      filteredOutCount: counts.filteredOutCount ?? null,
      matchedCount: counts.matchedCount ?? null
    });
  }

  async upsertValidationResults(_items: UpsertValidationResultInput[]): Promise<void> {
    return Promise.resolve();
  }

  async listValidationResults(query: ValidationResultsQuery): Promise<ValidationResultsPage> {
    const result = await selectValidationResultsPage(this.sqlClient, query);
    const rows: ValidationResultRow[] = result.items;

    return {
      items: rows.map((row) => ({
        resultId: row.ResultId,
        pipelineRunId: row.PipelineRunId,
        applicationId: row.ApplicationId,
        stageId: row.StageId,
        recordKey: row.RecordKey,
        status: row.Status,
        errorMessage: row.ErrorMessage,
        createdBy: row.CreatedBy,
        updatedBy: row.UpdatedBy,
        createDate: row.CreateDate,
        updateDate: row.UpdateDate
      })),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    };
  }

  async upsertMatchedRecords(items: UpsertMatchedRecordInput[]): Promise<void> {
    if (items.length === 0) {
      return;
    }

    await upsertMatchedRecords(this.sqlClient, items);
  }

  async listMatchedRecords(runId: string): Promise<MatchedRecord[]> {
    const rows: MatchedRecordRow[] = await selectMatchedRecordsByRunId(this.sqlClient, runId);
    return rows.map((row) => ({
      matchedId: row.MatchedId,
      pipelineRunId: row.PipelineRunId,
      applicationId: row.ApplicationId,
      numeratorKey: row.NumeratorKey,
      denominatorKey: row.DenominatorKey,
      revenueAmount: row.RevenueAmount,
      stageId: row.StageId,
      createdBy: row.CreatedBy,
      updatedBy: row.UpdatedBy,
      createDate: row.CreateDate,
      updateDate: row.UpdateDate
    }));
  }

  async setRunSnapshotDate(runId: string, actorUserId: string, snapshotDate: string): Promise<void> {
    await setPipelineRunSnapshotDate(this.sqlClient, {
      runId,
      actorUserId,
      snapshotDate
    });
  }

  async setRunStatus(runId: string, actorUserId: string, status: PipelineRunStatus): Promise<PipelineRun | null> {
    return this.updateRunStatus({ runId, actorUserId, status });
  }

  async executeLocalPipeline(input: CreatePipelineRunInput): Promise<void> {
    await this.sqlClient.query(
      `EXEC app.usp_ExecutePipelineRun @runId = @runId, @applicationId = @applicationId, @triggerSource = @triggerSource, @actorUserId = @actorUserId;`,
      {
        runId: input.runId,
        applicationId: input.applicationId,
        triggerSource: input.triggerSource,
        actorUserId: input.actorUserId
      }
    );
  }
}
