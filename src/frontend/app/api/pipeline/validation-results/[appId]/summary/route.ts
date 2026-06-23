import { ValidationPipelineService } from "@/core/application/services/validationPipelineService";
import { AppError, toStatusCode } from "@/lib/api/error-handler";
import { requireActive } from "@/lib/auth/guards";
import { getRuntimeRepositories, getRuntimeValidationPipelineRepository } from "@/infrastructure/persistence/runtime/repositories";
import {
  createOperationContext,
  logOperationStart,
  logOperationError
} from "@/lib/api/operation-logger";

function toContractError(error: unknown): { error: string; message: string } {
  if (error instanceof AppError) {
    return { error: error.code, message: error.message };
  }

  return { error: "INTERNAL_ERROR", message: "An unexpected error occurred." };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ appId: string }> }
): Promise<Response> {
  const repositories = getRuntimeRepositories();
  const opCtx = createOperationContext(request);
  logOperationStart(opCtx);
  const start = Date.now();

  try {
    const session = await requireActive(request, repositories);
    opCtx.callerUserId = session.userId;
    const { appId } = await context.params;

    const activeApplications = await repositories.applications.listActive();
    const application = activeApplications.find((app) => app.applicationId === appId) ?? null;
    if (!application) {
      throw new AppError(404, "NOT_FOUND", "Application not found or inactive.");
    }

    const { searchParams } = new URL(request.url);
    const runId = searchParams.get("runId") ?? undefined;

    const service = new ValidationPipelineService(getRuntimeValidationPipelineRepository());
    const summary = await service.getValidationSummary(session, {
      applicationId: appId,
      applicationName: application.applicationName,
      runId
    });

    return Response.json(summary, { status: 200 });
  } catch (error: unknown) {
    const status = toStatusCode(error);
    logOperationError(opCtx, error, status, Date.now() - start);
    return Response.json(toContractError(error), { status });
  }
}
