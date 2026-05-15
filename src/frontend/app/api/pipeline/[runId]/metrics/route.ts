import { MetricsRetrievalService } from "@/core/application/services/metricsRetrievalService";
import { metricsRunPathSchema } from "@/core/application/dto/metricsDto";
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
  context: { params: Promise<{ runId: string }> }
): Promise<Response> {
  const repositories = getRuntimeRepositories();

  try {
    const session = await requireActive(request, repositories);
    const { runId } = await context.params;
    const parsed = metricsRunPathSchema.safeParse({ runId });

    if (!parsed.success) {
      return Response.json({ error: "VALIDATION_ERROR", message: "Invalid run ID." }, { status: 400 });
    }

    const service = new MetricsRetrievalService(getRuntimeMetricsRepository(), repositories.applications);
    const summary = await service.getRunMetricsSummary(session, parsed.data.runId);

    if (!summary) {
      throw new AppError(404, "NOT_FOUND", "Pipeline run metrics not found.");
    }

    return Response.json(summary, { status: 200 });
  } catch (error: unknown) {
    return Response.json(toContractError(error), { status: toStatusCode(error) });
  }
}
