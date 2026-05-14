export interface MatchedRecord {
  matchedId: string;
  pipelineRunId: string;
  applicationId: string;
  numeratorKey: string;
  denominatorKey: string;
  revenueAmount: number | null;
  stageId: string | null;
  createdBy: string;
  updatedBy: string;
  createDate: string;
  updateDate: string;
}

export interface UpsertMatchedRecordInput {
  matchedId: string;
  pipelineRunId: string;
  applicationId: string;
  numeratorKey: string;
  denominatorKey: string;
  revenueAmount: number | null;
  stageId: string | null;
  actorUserId: string;
}
