export interface TriggerPipelineInput {
  runId: string;
  applicationId: string;
  triggerSource: "API" | "ADF" | "Manual" | "Preview";
  actorUserId: string;
  previewSessionId?: string;
}

export interface TriggerPipelineResult {
  accepted: boolean;
  executionMode: "adf" | "local";
  externalRunId?: string;
}