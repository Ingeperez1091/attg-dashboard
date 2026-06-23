import { toStatusCode } from "@/lib/api/error-handler";
import { requireActive } from "@/lib/auth/guards";
import { getRuntimeRepositories } from "@/infrastructure/persistence/runtime/repositories";
import { getContainer } from "@/lib/di/container";

export async function GET(request: Request): Promise<Response> {
  const repositories = getRuntimeRepositories();

  try {
    await requireActive(request, repositories);
    const applications = await getContainer().applicationService.listActiveApplications();
    return Response.json({ applications }, { status: 200 });
  } catch (error: unknown) {
    const status = toStatusCode(error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred.";
    return Response.json({ error: status === 401 ? "UNAUTHORIZED" : "FORBIDDEN", message }, { status });
  }
}
