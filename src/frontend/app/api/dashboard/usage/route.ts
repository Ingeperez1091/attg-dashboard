import { DashboardUsageService } from "@/core/application/services/dashboardUsageService";
import { ValidationPipelineService } from "@/core/application/services/validationPipelineService";
import { SessionEntity } from "@/core/domain/entities/SessionEntity";
import {
  getRuntimeDashboardUsageRepository,
  getRuntimeRepositories,
  getRuntimeValidationPipelineRepository
} from "@/infrastructure/persistence/runtime/repositories";
import { AppError, toStatusCode } from "@/lib/api/error-handler";
import {
  createOperationContext,
  logOperationStart,
  logOperationError,
  logOperationValidationFailure
} from "@/lib/api/operation-logger";
import { requireActive } from "@/lib/auth/guards";
import { dashboardUsageQuerySchema } from "@/lib/validation/dashboardUsageSchema";

function toContractError(error: unknown): { error: string; message: string } {
  if (error instanceof AppError) {
    return { error: error.code, message: error.message };
  }

  return { error: "DASHBOARD_DATA_UNAVAILABLE", message: "Dashboard data is temporarily unavailable." };
}

export async function GET(request: Request): Promise<Response> {
  const repositories = getRuntimeRepositories();
  const service = new DashboardUsageService(getRuntimeDashboardUsageRepository(), repositories.applications);
  const opCtx = createOperationContext(request);
  logOperationStart(opCtx);
  const start = Date.now();
  let session: SessionEntity | null = null;
  let parsedQuery: { subServiceLine?: string; runId?: string } | null = null;

  try {
    session = await requireActive(request, repositories);
    opCtx.callerUserId = session.userId;
    const { searchParams } = new URL(request.url);
    const queryResult = dashboardUsageQuerySchema.safeParse({
      subServiceLine: searchParams.get("subServiceLine") ?? undefined,
      runId: searchParams.get("runId") ?? undefined
    });

    if (!queryResult.success) {
      logOperationValidationFailure(opCtx, [{ field: "query", message: "Invalid query parameters." }]);
      return Response.json({ error: "VALIDATION_ERROR", message: "Invalid query parameters." }, { status: 400 });
    }

    parsedQuery = queryResult.data;

    if (parsedQuery.runId) {
      const validationService = new ValidationPipelineService(getRuntimeValidationPipelineRepository());
      const run = await validationService.getRunStatus(session, parsedQuery.runId);
      if (!run) {
        throw new AppError(404, "NOT_FOUND", "Pipeline run not found.");
      }
    }

    const usage = await service.getUsage(session, parsedQuery);

    return Response.json(usage, { status: 200 });
  } catch (error: unknown) {
    if (!(error instanceof AppError) && session && parsedQuery) {
      try {
        const usage = await service.getErrorUsage(session, parsedQuery);
        return Response.json({ ...usage, error: "DASHBOARD_DATA_UNAVAILABLE" }, { status: 500 });
      } catch {
        // Fall through to the generic contract error if the fallback envelope cannot be built.
      }
    }

    const status = toStatusCode(error);
    logOperationError(opCtx, error, status, Date.now() - start);
    return Response.json(toContractError(error), { status });
  }
}