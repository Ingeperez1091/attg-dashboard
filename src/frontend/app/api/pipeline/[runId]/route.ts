import { ValidationPipelineService } from "@/core/application/services/validationPipelineService";
import { AppError, toStatusCode } from "@/lib/api/error-handler";
import { requireActive } from "@/lib/auth/guards";
import { getRuntimeRepositories, getRuntimeValidationPipelineRepository } from "@/infrastructure/persistence/runtime/repositories";

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

    const service = new ValidationPipelineService(getRuntimeValidationPipelineRepository());
    const run = await service.getRunStatus(session, runId);

    if (!run) {
      throw new AppError(404, "NOT_FOUND", "Pipeline run not found.");
    }

    return Response.json(run, { status: 200 });
  } catch (error: unknown) {
    return Response.json(toContractError(error), { status: toStatusCode(error) });
  }
}
