import { AppError, toStatusCode } from "@/lib/api/error-handler";
import { getRuntimeRepositories } from "@/infrastructure/persistence/runtime/repositories";
import { getRuntimeNumeratorFilterRepository } from "@/infrastructure/persistence/runtime/repositories";
import { logMutationEvent } from "@/lib/api/request-logger";
import {
  requireFilterReadScope,
  requireFilterWriteScope
} from "@/infrastructure/middleware/filterAuthorizationMiddleware";
import { NumeratorFilterService } from "@/core/application/services/NumeratorFilterService";
import { updateNumeratorFiltersSchema } from "@/infrastructure/validation/filterRuleSchemas";

function toContractError(error: unknown): { error: string; message: string } {
  const status = toStatusCode(error);
  const message = error instanceof Error ? error.message : "An unexpected error occurred.";

  if (status === 401) return { error: "Unauthorized", message };
  if (status === 403) return { error: "Forbidden", message };
  if (status === 404) return { error: "NotFound", message };
  return { error: "InternalServerError", message: status >= 500 ? "An unexpected error occurred. Please contact support." : message };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ appId: string }> }
): Promise<Response> {
  const repositories = getRuntimeRepositories();

  try {
    const { appId } = await context.params;
    await requireFilterReadScope(request, appId, repositories);

    const service = new NumeratorFilterService(getRuntimeNumeratorFilterRepository());
    const ruleset = await service.getFiltersByApplicationId(appId);

    return Response.json(ruleset, { status: 200 });
  } catch (error: unknown) {
    return Response.json(toContractError(error), { status: toStatusCode(error) });
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ appId: string }> }
): Promise<Response> {
  const repositories = getRuntimeRepositories();

  try {
    const { appId } = await context.params;
    const session = await requireFilterWriteScope(request, appId, repositories);

    const body = await request.json();
    const parsed = updateNumeratorFiltersSchema.safeParse(body);
    
    if (!parsed.success) {
      return Response.json({
        error: "VALIDATION_ERROR",
        message: "Invalid request body.",
        details: {
          code: "INVALID_REQUEST_BODY"
        }
      }, { status: 400 });
    }

    const service = new NumeratorFilterService(getRuntimeNumeratorFilterRepository());
    const updated = await service.updateFilters(appId, session.userId, parsed.data.rules);
    logMutationEvent("numerator.filters.update", session.userId, {
      applicationId: appId,
      ruleCount: parsed.data.rules.length
    });
    return Response.json(updated, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof AppError && error.status === 400 && error.code === "FIELD_NOT_FILTERABLE") {
      return Response.json({
        error: "VALIDATION_ERROR",
        message: error.message,
        details: {
          code: "FIELD_NOT_FILTERABLE"
        }
      }, { status: 400 });
    }

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
