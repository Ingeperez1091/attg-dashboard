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
import { UpsertValidationResultInput, ValidationResult } from "@/core/domain/entities/ValidationResult";
import { createStoreAccessor } from "@/infrastructure/persistence/memory/sharedStore";

type ValidationPipelineRepoStore = {
  runs: PipelineRun[];
  validationResults: ValidationResult[];
  matchedRecords: MatchedRecord[];
};

const sharedStoreFile = process.env.TEST_VALIDATION_PIPELINE_REPOSITORY_STORE_FILE;

const { getStore, writeStore } = createStoreAccessor<ValidationPipelineRepoStore>({
  storeFilePath: sharedStoreFile,
  globalKey: "__dashboardValidationPipelineRepoStore",
  createEmptyStore: () => ({ runs: [], validationResults: [], matchedRecords: [] })
});

export class ValidationPipelineMemoryRepository implements IValidationPipelineRepository {
  async createRun(input: CreatePipelineRunInput): Promise<PipelineRun> {
    const run: PipelineRun = {
      runId: input.runId,
      applicationId: input.applicationId,
      status: "Queued",
      triggerSource: input.triggerSource,
      startTime: null,
      endTime: null,
      totalRecordsIn: null,
      validCount: null,
      invalidCount: null,
      duplicateCount: null,
      filteredOutCount: null,
      matchedCount: null,
      errorMessage: null,
      snapshotDate: null,
      createdBy: input.actorUserId,
      updatedBy: input.actorUserId,
      createDate: new Date().toISOString(),
      updateDate: new Date().toISOString()
    };

    const store = getStore();
    store.runs.unshift(run);
    writeStore(store);
    return run;
  }

  async getRunById(runId: string): Promise<PipelineRun | null> {
    const run = getStore().runs.find((item) => item.runId === runId);
    return run ?? null;
  }

  async listRunsByApplication(applicationId: string, limit: number): Promise<PipelineRun[]> {
    return getStore().runs.filter((item) => item.applicationId === applicationId).slice(0, limit);
  }

  async updateRunStatus(input: UpdatePipelineRunStatusInput): Promise<PipelineRun | null> {
    const store = getStore();
    const run = store.runs.find((item) => item.runId === input.runId);

    if (!run) {
      return null;
    }

    run.status = input.status;
    run.updatedBy = input.actorUserId;
    run.updateDate = new Date().toISOString();

    if (typeof input.errorMessage !== "undefined") {
      run.errorMessage = input.errorMessage;
    }
    if (typeof input.startTime !== "undefined") {
      run.startTime = input.startTime;
    }
    if (typeof input.endTime !== "undefined") {
      run.endTime = input.endTime;
    }

    writeStore(store);
    return run;
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
    const store = getStore();
    const run = store.runs.find((item) => item.runId === runId);

    if (!run) {
      return;
    }

    Object.assign(run, counts);
    run.updatedBy = actorUserId;
    run.updateDate = new Date().toISOString();
    writeStore(store);
  }

  async upsertValidationResults(items: UpsertValidationResultInput[]): Promise<void> {
    const store = getStore();

    for (const item of items) {
      const index = store.validationResults.findIndex((row) => row.resultId === item.resultId);
      const next: ValidationResult = {
        resultId: item.resultId,
        pipelineRunId: item.pipelineRunId,
        applicationId: item.applicationId,
        stageId: item.stageId,
        recordKey: item.recordKey,
        status: item.status,
        errorMessage: item.errorMessage,
        createdBy: item.actorUserId,
        updatedBy: item.actorUserId,
        createDate: new Date().toISOString(),
        updateDate: new Date().toISOString()
      };

      if (index >= 0) {
        store.validationResults[index] = next;
      } else {
        store.validationResults.push(next);
      }
    }

    writeStore(store);
  }

  async listValidationResults(query: ValidationResultsQuery): Promise<ValidationResultsPage> {
    const filtered = getStore().validationResults.filter((row) => {
      if (row.applicationId !== query.applicationId) {
        return false;
      }

      if (query.runId && row.pipelineRunId !== query.runId) {
        return false;
      }

      if (query.status && row.status !== query.status) {
        return false;
      }

      return true;
    });

    const start = (query.page - 1) * query.pageSize;
    const items = filtered.slice(start, start + query.pageSize);

    return {
      items,
      total: filtered.length,
      page: query.page,
      pageSize: query.pageSize
    };
  }

  async upsertMatchedRecords(items: UpsertMatchedRecordInput[]): Promise<void> {
    const store = getStore();

    for (const item of items) {
      const index = store.matchedRecords.findIndex((row) => row.matchedId === item.matchedId);
      const next: MatchedRecord = {
        matchedId: item.matchedId,
        pipelineRunId: item.pipelineRunId,
        applicationId: item.applicationId,
        numeratorKey: item.numeratorKey,
        denominatorKey: item.denominatorKey,
        revenueAmount: item.revenueAmount,
        stageId: item.stageId,
        createdBy: item.actorUserId,
        updatedBy: item.actorUserId,
        createDate: new Date().toISOString(),
        updateDate: new Date().toISOString()
      };

      if (index >= 0) {
        store.matchedRecords[index] = next;
      } else {
        store.matchedRecords.push(next);
      }
    }

    writeStore(store);
  }

  async listMatchedRecords(runId: string): Promise<MatchedRecord[]> {
    return getStore().matchedRecords.filter((row) => row.pipelineRunId === runId);
  }

  async setRunSnapshotDate(runId: string, actorUserId: string, snapshotDate: string): Promise<void> {
    const store = getStore();
    const run = store.runs.find((item) => item.runId === runId);
    if (!run) {
      return;
    }

    run.snapshotDate = snapshotDate;
    run.updatedBy = actorUserId;
    run.updateDate = new Date().toISOString();
    writeStore(store);
  }

  async setRunStatus(runId: string, actorUserId: string, status: PipelineRunStatus): Promise<PipelineRun | null> {
    return this.updateRunStatus({ runId, actorUserId, status });
  }

  async executeLocalPipeline(_input: CreatePipelineRunInput): Promise<void> {
    return Promise.resolve();
  }
}
