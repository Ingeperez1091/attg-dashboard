export type ValidationRecordStatus = "Valid" | "Invalid" | "Duplicate" | "FilteredOut";

export interface ValidationResult {
  resultId: string;
  pipelineRunId: string;
  applicationId: string;
  stageId: string;
  recordKey: string | null;
  status: ValidationRecordStatus;
  errorMessage: string | null;
  createdBy: string;
  updatedBy: string;
  createDate: string;
  updateDate: string;
}

export interface UpsertValidationResultInput {
  resultId: string;
  pipelineRunId: string;
  applicationId: string;
  stageId: string;
  recordKey: string | null;
  status: ValidationRecordStatus;
  errorMessage: string | null;
  actorUserId: string;
}
