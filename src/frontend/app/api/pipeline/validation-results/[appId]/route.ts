import { ValidationPipelineService } from "@/core/application/services/validationPipelineService";
import { AppError, toStatusCode } from "@/lib/api/error-handler";
import { requireActive } from "@/lib/auth/guards";
import { getRuntimeRepositories, getRuntimeValidationPipelineRepository } from "@/infrastructure/persistence/runtime/repositories";
import { validationResultsQuerySchema } from "@/infrastructure/validation/pipelineSchemas";

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

    const activeApplications = await repositories.applications.listActive();
    const applicationExists = activeApplications.some((app) => app.applicationId === appId);
    if (!applicationExists) {
      throw new AppError(404, "NOT_FOUND", "Application not found or inactive.");
    }

    const { searchParams } = new URL(request.url);
    const rawQuery = {
      runId: searchParams.get("runId") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined
    };

    const parsed = validationResultsQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      return Response.json({ error: "VALIDATION_ERROR", message: "Invalid query parameters." }, { status: 400 });
    }

    const service = new ValidationPipelineService(getRuntimeValidationPipelineRepository());
    const page = await service.getValidationResults(session, {
      applicationId: appId,
      runId: parsed.data.runId,
      status: parsed.data.status,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize
    });

    return Response.json(
      {
        applicationId: appId,
        runId: parsed.data.runId ?? null,
        totalCount: page.total,
        page: page.page,
        pageSize: page.pageSize,
        results: page.items.map((r) => ({
          resultId: r.resultId,
          stageId: r.stageId,
          recordKey: r.recordKey,
          status: r.status,
          errorMessage: r.errorMessage,
          createDate: r.createDate
        }))
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    return Response.json(toContractError(error), { status: toStatusCode(error) });
  }
}
