import { PipelineOrchestrationService } from "@/core/application/services/pipelineOrchestrationService";
import { AppError } from "@/lib/api/error-handler";
import { toPublicContractError, toStatusCode } from "@/lib/api/error-handler";
import { requireActive } from "@/lib/auth/guards";
import { getRuntimeADFPipelineClient, getRuntimeRepositories, getRuntimeValidationPipelineRepository } from "@/infrastructure/persistence/runtime/repositories";
import { triggerPipelineRequestSchema } from "@/infrastructure/validation/pipelineSchemas";

export async function POST(request: Request): Promise<Response> {
  const repositories = getRuntimeRepositories();

  try {
    const session = await requireActive(request, repositories);
    const body = await request.json().catch(() => null);
    const parsed = triggerPipelineRequestSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: "VALIDATION_ERROR", message: "Invalid request body." }, { status: 400 });
    }

    const activeApplications = await repositories.applications.listActive();
    const applicationExists = activeApplications.some((app) => app.applicationId === parsed.data.applicationId);
    if (!applicationExists) {
      throw new AppError(404, "NOT_FOUND", "Application not found or inactive.");
    }

    const repository = getRuntimeValidationPipelineRepository();
    const latestRun = (await repository.listRunsByApplication(parsed.data.applicationId, 1))[0] ?? null;
    if (latestRun && (latestRun.status === "Queued" || latestRun.status === "Processing")) {
      throw new AppError(409, "CONFLICT", "A pipeline run is already in progress for this application.");
    }

    const service = new PipelineOrchestrationService(repository, getRuntimeADFPipelineClient());
    const result = await service.triggerForApplication(session, parsed.data);

    return Response.json(
      {
        runId: result.run.runId,
        applicationId: result.run.applicationId,
        status: result.run.status,
        triggerSource: result.run.triggerSource,
        createDate: result.run.createDate,
        executionMode: result.executionMode
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    return Response.json(toPublicContractError(error), { status: toStatusCode(error) });
  }
}
