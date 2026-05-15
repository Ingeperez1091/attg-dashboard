import { toStatusCode } from "@/lib/api/error-handler";
import { requireActive } from "@/lib/auth/guards";
import {
  getRuntimeDenominatorModelRepository,
  getRuntimeRepositories
} from "@/infrastructure/persistence/runtime/repositories";
import { DenominatorFilterService } from "@/core/application/services/DenominatorFilterService";

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

export async function GET(request: Request): Promise<Response> {
  const repositories = getRuntimeRepositories();

  try {
    await requireActive(request, repositories);
    const service = new DenominatorFilterService(
      getRuntimeRepositories().denominatorFilter,
      getRuntimeDenominatorModelRepository()
    );
    const fields = await service.getModelFields();

    return Response.json({ fields }, { status: 200 });
  } catch (error: unknown) {
    return Response.json(toContractError(error), { status: toStatusCode(error) });
  }
}
