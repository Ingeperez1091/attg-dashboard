import { DashboardUsageService } from "@/core/application/services/dashboardUsageService";
import {
  getRuntimeDashboardUsageRepository,
  getRuntimeRepositories
} from "@/infrastructure/persistence/runtime/repositories";
import { AppError, toStatusCode } from "@/lib/api/error-handler";
import { requireActive } from "@/lib/auth/guards";

function toContractError(error: unknown): { error: string; message: string } {
  if (error instanceof AppError) {
    return { error: error.code, message: error.message };
  }

  return { error: "DASHBOARD_DATA_UNAVAILABLE", message: "Dashboard state is temporarily unavailable." };
}

export async function GET(request: Request): Promise<Response> {
  const repositories = getRuntimeRepositories();

  try {
    const session = await requireActive(request, repositories);
    const service = new DashboardUsageService(getRuntimeDashboardUsageRepository(), repositories.applications);
    const state = await service.getState(session);

    return Response.json(state, { status: 200 });
  } catch (error: unknown) {
    return Response.json(toContractError(error), { status: toStatusCode(error) });
  }
}