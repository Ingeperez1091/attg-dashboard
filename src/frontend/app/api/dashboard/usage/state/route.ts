import { DashboardUsageService } from "@/core/application/services/dashboardUsageService";
import {
  getRuntimeDashboardUsageRepository,
  getRuntimeRepositories
} from "@/infrastructure/persistence/runtime/repositories";
import { AppError, toStatusCode } from "@/lib/api/error-handler";
import {
  createOperationContext,
  logOperationStart,
  logOperationSuccess,
  logOperationError
} from "@/lib/api/operation-logger";
import { requireActive } from "@/lib/auth/guards";

function toContractError(error: unknown): { error: string; message: string } {
  if (error instanceof AppError) {
    return { error: error.code, message: error.message };
  }

  return { error: "DASHBOARD_DATA_UNAVAILABLE", message: "Dashboard state is temporarily unavailable." };
}

export async function GET(request: Request): Promise<Response> {
  const repositories = getRuntimeRepositories();
  const opCtx = createOperationContext(request);
  logOperationStart(opCtx);
  const start = Date.now();

  try {
    const session = await requireActive(request, repositories);
    opCtx.callerUserId = session.userId;
    const service = new DashboardUsageService(getRuntimeDashboardUsageRepository(), repositories.applications);
    const state = await service.getState(session);

    logOperationSuccess(opCtx, 200, Date.now() - start);
    return Response.json(state, { status: 200 });
  } catch (error: unknown) {
    const status = toStatusCode(error);
    logOperationError(opCtx, error, status, Date.now() - start);
    return Response.json(toContractError(error), { status });
  }
}