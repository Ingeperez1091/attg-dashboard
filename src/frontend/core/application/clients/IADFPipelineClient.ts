import { TriggerPipelineInput, TriggerPipelineResult } from "@/core/application/dto/pipeline/PipelineTriggerDto";

export interface IADFPipelineClient {
  readonly executionMode: "adf" | "local";
  triggerValidationPipeline(input: TriggerPipelineInput): Promise<TriggerPipelineResult>;
}
