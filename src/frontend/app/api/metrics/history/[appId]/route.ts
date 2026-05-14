import { MetricsRetrievalService } from "@/core/application/services/metricsRetrievalService";
import { metricsAppPathSchema, metricsHistoryQuerySchema } from "@/core/application/dto/metricsDto";
import {
  getRuntimeMetricsRepository,
  getRuntimeRepositories
} from "@/infrastructure/persistence/runtime/repositories";
import { AppError, toStatusCode } from "@/lib/api/error-handler";
import { requireActive } from "@/lib/auth/guards";

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

  try {
    const session = await requireActive(request, repositories);
    const { appId } = await context.params;
    const parsedPath = metricsAppPathSchema.safeParse({ appId });

    if (!parsedPath.success) {
      return Response.json({ error: "VALIDATION_ERROR", message: "Invalid application ID." }, { status: 400 });
    }

    const url = new URL(request.url);
    const parsedQuery = metricsHistoryQuerySchema.safeParse({
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
      runId: url.searchParams.get("runId") ?? undefined
    });

    if (!parsedQuery.success) {
      return Response.json({ error: "VALIDATION_ERROR", message: "Invalid query parameters." }, { status: 400 });
    }

    const service = new MetricsRetrievalService(getRuntimeMetricsRepository(), repositories.applications);
    const history = await service.getSnapshotHistory(session, {
      applicationId: parsedPath.data.appId,
      runId: parsedQuery.data.runId,
      from: parsedQuery.data.from ?? null,
      to: parsedQuery.data.to ?? null,
      page: parsedQuery.data.page,
      pageSize: parsedQuery.data.pageSize
    });

    return Response.json(history, { status: 200 });
  } catch (error: unknown) {
    return Response.json(toContractError(error), { status: toStatusCode(error) });
  }
}
