import { toStatusCode } from "@/lib/api/error-handler";
import { getRuntimeRepositories } from "@/infrastructure/persistence/runtime/repositories";
import { getRuntimeNumeratorFilterRepository } from "@/infrastructure/persistence/runtime/repositories";
import { requireFilterReadScope } from "@/infrastructure/middleware/filterAuthorizationMiddleware";
import { NumeratorFilterService } from "@/core/application/services/NumeratorFilterService";

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
    const fields = await service.getModelByApplicationId(appId);
    const applications = await repositories.applications.listActive();
    const app = applications.find((item) => item.applicationId === appId);

    if (!app) {
      return Response.json({ error: "NotFound", message: "Application not found" }, { status: 404 });
    }

    return Response.json({
      applicationId: appId,
      applicationName: app.applicationName,
      fields
    }, { status: 200 });
  } catch (error: unknown) {
    return Response.json(toContractError(error), { status: toStatusCode(error) });
  }
}
