export interface TriggerPipelineInput {
  runId: string;
  applicationId: string;
  triggerSource: "API" | "ADF" | "Manual";
  actorUserId: string;
}

export interface TriggerPipelineResult {
  accepted: boolean;
  executionMode: "adf" | "local";
  externalRunId?: string;
}