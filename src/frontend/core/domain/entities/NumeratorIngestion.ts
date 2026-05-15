export interface StageNumeratorPayloadInput {
  applicationId: string;
  payloadJson: string;
  createdBy: string;
}

export interface StageNumeratorPayloadResult {
  stageId: string;
  applicationId: string;
  createdBy: string;
  createDate: string;
  payloadJson: string;
}
