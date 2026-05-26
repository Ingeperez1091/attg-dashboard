import { MetricsRetrievalService } from "@/core/application/services/metricsRetrievalService";
import { metricsAppPathSchema, metricsLatestQuerySchema } from "@/core/application/dto/metricsDto";
import {
  getRuntimeMetricsRepository,
  getRuntimeRepositories
} from "@/infrastructure/persistence/runtime/repositories";
import { AppError , toPublicContractError, toStatusCode } from "@/lib/api/error-handler";
import {
  createOperationContext,
  logOperationStart,
  logOperationSuccess,
  logOperationError,
  logOperationValidationFailure
} from "@/lib/api/operation-logger";
import { requireActive } from "@/lib/auth/guards";

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
    const parsedPath = metricsAppPathSchema.safeParse({ appId });

    if (!parsedPath.success) {
      logOperationValidationFailure(opCtx, [{ field: "appId", message: "Invalid application ID." }]);
      return Response.json({ error: "VALIDATION_ERROR", message: "Invalid application ID." }, { status: 400 });
    }

    const url = new URL(request.url);
    const query = metricsLatestQuerySchema.safeParse({
      runId: url.searchParams.get("runId") ?? undefined,
      includeSynthetic: url.searchParams.get("includeSynthetic") ?? undefined
    });

    if (!query.success) {
      logOperationValidationFailure(opCtx, [{ field: "query", message: "Invalid query parameters." }]);
      return Response.json({ error: "VALIDATION_ERROR", message: "Invalid query parameters." }, { status: 400 });
    }

    const service = new MetricsRetrievalService(getRuntimeMetricsRepository(), repositories.applications);
    const snapshot = await service.getLatestSnapshot(session, {
      applicationId: parsedPath.data.appId,
      runId: query.data.runId,
      includeSynthetic: query.data.includeSynthetic
    });

    if (!snapshot) {
      throw new AppError(404, "NOT_FOUND", "No metric snapshot found for the requested scope.");
    }

    logOperationSuccess(opCtx, 200, Date.now() - start);
    return Response.json(snapshot, { status: 200 });
  } catch (error: unknown) {
    const status = toStatusCode(error);
    logOperationError(opCtx, error, status, Date.now() - start);
    return Response.json(toPublicContractError(error), { status });
  }
}
