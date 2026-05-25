import { PipelineOrchestrationService } from "@/core/application/services/pipelineOrchestrationService";
import { AppError } from "@/lib/api/error-handler";
import { toPublicContractError, toStatusCode } from "@/lib/api/error-handler";
import { requireActive } from "@/lib/auth/guards";
import { getRuntimeADFPipelineClient, getRuntimeRepositories, getRuntimeValidationPipelineRepository } from "@/infrastructure/persistence/runtime/repositories";
import { triggerPipelineRequestSchema } from "@/infrastructure/validation/pipelineSchemas";
import {
  createOperationContext,
  logOperationStart,
  logOperationError,
  logOperationValidationFailure
} from "@/lib/api/operation-logger";

export async function POST(request: Request): Promise<Response> {
  const repositories = getRuntimeRepositories();
  const opCtx = createOperationContext(request);
  logOperationStart(opCtx);
  const start = Date.now();

  try {
    const session = await requireActive(request, repositories);
    opCtx.callerUserId = session.userId;
    const body = await request.json().catch(() => null);
    const parsed = triggerPipelineRequestSchema.safeParse(body);

    if (!parsed.success) {
      const failures = parsed.error.errors.map((e) => ({
        field: e.path.join(".") || "request",
        message: e.message
      }));
      logOperationValidationFailure(opCtx, failures);
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
    const status = toStatusCode(error);
    logOperationError(opCtx, error, status, Date.now() - start);
    return Response.json(toPublicContractError(error), { status });
  }
}
