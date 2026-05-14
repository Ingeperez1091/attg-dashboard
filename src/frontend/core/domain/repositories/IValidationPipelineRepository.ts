import {
  CreatePipelineRunInput,
  PipelineRun,
  PipelineRunStatus,
  UpdatePipelineRunStatusInput
} from "@/core/domain/entities/PipelineRun";
import { MatchedRecord, UpsertMatchedRecordInput } from "@/core/domain/entities/MatchedRecord";
import { UpsertValidationResultInput, ValidationResult, ValidationRecordStatus } from "@/core/domain/entities/ValidationResult";

export interface ValidationResultsQuery {
  applicationId: string;
  runId?: string;
  status?: ValidationRecordStatus;
  page: number;
  pageSize: number;
}

export interface ValidationResultsPage {
  items: ValidationResult[];
  total: number;
  page: number;
  pageSize: number;
}

export interface IValidationPipelineRepository {
  createRun(input: CreatePipelineRunInput): Promise<PipelineRun>;
  getRunById(runId: string): Promise<PipelineRun | null>;
  listRunsByApplication(applicationId: string, limit: number): Promise<PipelineRun[]>;
  updateRunStatus(input: UpdatePipelineRunStatusInput): Promise<PipelineRun | null>;
  updateRunCounts(
    runId: string,
    actorUserId: string,
    counts: Partial<
      Pick<
        PipelineRun,
        "totalRecordsIn" | "validCount" | "invalidCount" | "duplicateCount" | "filteredOutCount" | "matchedCount"
      >
    >
  ): Promise<void>;
  upsertValidationResults(items: UpsertValidationResultInput[]): Promise<void>;
  listValidationResults(query: ValidationResultsQuery): Promise<ValidationResultsPage>;
  upsertMatchedRecords(items: UpsertMatchedRecordInput[]): Promise<void>;
  listMatchedRecords(runId: string): Promise<MatchedRecord[]>;
  setRunSnapshotDate(runId: string, actorUserId: string, snapshotDate: string): Promise<void>;
  setRunStatus(runId: string, actorUserId: string, status: PipelineRunStatus): Promise<PipelineRun | null>;
  executeLocalPipeline(input: CreatePipelineRunInput): Promise<void>;
}
