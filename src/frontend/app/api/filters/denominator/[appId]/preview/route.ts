import { AppError, toStatusCode } from "@/lib/api/error-handler";
import {
  getRuntimeAdoptionSettingsRepository,
  getRuntimeDenominatorFilterRepository,
  getRuntimeDenominatorModelRepository,
  getRuntimeRepositories
} from "@/infrastructure/persistence/runtime/repositories";
import { requireFilterWriteScope } from "@/infrastructure/middleware/filterAuthorizationMiddleware";
import { DenominatorFilterService } from "@/core/application/services/DenominatorFilterService";
import { updateDenominatorFiltersSchema } from "@/infrastructure/validation/denominatorFilterSchemas";

function toContractError(error: unknown): { error: string; message: string } {
  const status = toStatusCode(error);
  const message = error instanceof Error ? error.message : "An unexpected error occurred.";

  if (status === 401) return { error: "Unauthorized", message };
  if (status === 403) return { error: "Forbidden", message };
  if (status === 404) return { error: "NotFound", message };
  return {
    error: "InternalServerError",
    message: status >= 500 ? "An unexpected error occurred. Please contact support." : message
  };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ appId: string }> }
): Promise<Response> {
  const repositories = getRuntimeRepositories();

  try {
    const { appId } = await context.params;
    await requireFilterWriteScope(request, appId, repositories);

    const body = await request.json();
    const parsed = updateDenominatorFiltersSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({
        error: "VALIDATION_ERROR",
        message: "Invalid request body.",
        details: {
          code: "INVALID_REQUEST_BODY"
        }
      }, { status: 400 });
    }

    const service = new DenominatorFilterService(
      getRuntimeDenominatorFilterRepository(),
      getRuntimeDenominatorModelRepository(),
      getRuntimeAdoptionSettingsRepository()
    );

    const preview = await service.previewRules(appId, parsed.data.rules);
    return Response.json(preview, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof AppError && error.status === 400) {
      return Response.json({
        error: "VALIDATION_ERROR",
        message: error.message,
        details: {
          code: error.code
        }
      }, { status: 400 });
    }

    return Response.json(toContractError(error), { status: toStatusCode(error) });
  }
}
