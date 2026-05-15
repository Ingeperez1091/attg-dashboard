import {
  TriggerPipelineInput,
  TriggerPipelineResult
} from "@/core/application/dto/pipeline/PipelineTriggerDto";
import { IADFPipelineClient } from "@/core/application/clients/IADFPipelineClient";

export class ADFPipelineClient implements IADFPipelineClient {
  readonly executionMode: "adf" | "local";

  constructor(
    private readonly adfEndpoint = process.env.ADF_PIPELINE_TRIGGER_ENDPOINT,
    private readonly adfAuthToken = process.env.ADF_PIPELINE_TRIGGER_TOKEN
  ) {
    this.executionMode = adfEndpoint ? "adf" : "local";
  }

  async triggerValidationPipeline(input: TriggerPipelineInput): Promise<TriggerPipelineResult> {
    if (!this.adfEndpoint) {
      return {
        accepted: true,
        executionMode: "local"
      };
    }

    const response = await fetch(this.adfEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.adfAuthToken ? { Authorization: `Bearer ${this.adfAuthToken}` } : {})
      },
      body: JSON.stringify({
        applicationId: input.applicationId,
        runId: input.runId,
        triggerSource: input.triggerSource,
        actorUserId: input.actorUserId
      })
    });

    if (!response.ok) {
      throw new Error(`ADF trigger failed with status ${response.status}`);
    }

    const body = (await response.json().catch(() => ({}))) as { runId?: string };
    return {
      accepted: true,
      executionMode: "adf",
      externalRunId: body.runId
    };
  }
}
