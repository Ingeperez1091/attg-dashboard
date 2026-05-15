import { MetricsRetrievalService } from "@/core/application/services/metricsRetrievalService";
import { metricsAppPathSchema, metricsLatestQuerySchema } from "@/core/application/dto/metricsDto";
import {
  getRuntimeMetricsRepository,
  getRuntimeRepositories
} from "@/infrastructure/persistence/runtime/repositories";
import { AppError } from "@/lib/api/error-handler";
import { toPublicContractError, toStatusCode } from "@/lib/api/error-handler";
import { requireActive } from "@/lib/auth/guards";

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
    const query = metricsLatestQuerySchema.safeParse({
      runId: url.searchParams.get("runId") ?? undefined,
      includeSynthetic: url.searchParams.get("includeSynthetic") ?? undefined
    });

    if (!query.success) {
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

    return Response.json(snapshot, { status: 200 });
  } catch (error: unknown) {
    return Response.json(toPublicContractError(error), { status: toStatusCode(error) });
  }
}
