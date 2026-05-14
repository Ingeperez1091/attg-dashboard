export type PipelineRunStatus = "Queued" | "Processing" | "Completed" | "Failed";

export interface PipelineRun {
  runId: string;
  applicationId: string;
  status: PipelineRunStatus;
  triggerSource: "API" | "ADF" | "Manual";
  startTime: string | null;
  endTime: string | null;
  totalRecordsIn: number | null;
  validCount: number | null;
  invalidCount: number | null;
  duplicateCount: number | null;
  filteredOutCount: number | null;
  matchedCount: number | null;
  errorMessage: string | null;
  snapshotDate: string | null;
  createdBy: string;
  updatedBy: string;
  createDate: string;
  updateDate: string;
}

export interface CreatePipelineRunInput {
  runId: string;
  applicationId: string;
  triggerSource: "API" | "ADF" | "Manual";
  actorUserId: string;
}

export interface UpdatePipelineRunStatusInput {
  runId: string;
  status: PipelineRunStatus;
  actorUserId: string;
  errorMessage?: string | null;
  startTime?: string | null;
  endTime?: string | null;
}
