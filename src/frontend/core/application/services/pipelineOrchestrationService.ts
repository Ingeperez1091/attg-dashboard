import { randomUUID } from "node:crypto";
import { SessionEntity } from "@/core/domain/entities/SessionEntity";
import { PipelineRun } from "@/core/domain/entities/PipelineRun";
import { IValidationPipelineRepository } from "@/core/domain/repositories/IValidationPipelineRepository";
import { IADFPipelineClient } from "@/core/application/clients/IADFPipelineClient";
import { assertCanTriggerPipelineForApplication } from "@/lib/auth/pipelineAuthorization";

type PipelineExecutionMode = "adf" | "local";

function resolveExecutionMode(defaultMode: PipelineExecutionMode): PipelineExecutionMode {
  const configuredMode = process.env.PIPELINE_EXECUTION_MODE?.trim().toLowerCase();
  if (configuredMode === "adf" || configuredMode === "local") {
    return configuredMode;
  }

  return defaultMode;
}

export class PipelineOrchestrationService {
  constructor(
    private readonly repository: IValidationPipelineRepository,
    private readonly adfClient: IADFPipelineClient
  ) {}

  async triggerForApplication(
    session: SessionEntity,
    input: { applicationId: string; triggerSource: "API" | "ADF" | "Manual" }
  ): Promise<{ run: PipelineRun; executionMode: "adf" | "local" }> {
    assertCanTriggerPipelineForApplication(session, input.applicationId);

    const runId = randomUUID();
    const run = await this.repository.createRun({
      runId,
      applicationId: input.applicationId,
      triggerSource: input.triggerSource,
      actorUserId: session.userId
    });

    const executionMode = resolveExecutionMode(this.adfClient.executionMode);

    if (executionMode === "adf") {
      await this.adfClient.triggerValidationPipeline({
        runId,
        applicationId: input.applicationId,
        triggerSource: input.triggerSource,
        actorUserId: session.userId
      });
    } else {
      void this.repository.executeLocalPipeline({
        runId,
        applicationId: input.applicationId,
        triggerSource: input.triggerSource,
        actorUserId: session.userId
      });
    }

    return { run, executionMode };
  }
}
