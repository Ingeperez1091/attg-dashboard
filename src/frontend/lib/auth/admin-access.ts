import { AppError } from "@/lib/api/error-handler";
import { requireAdministrator } from "@/lib/auth/guards";
import { RepositoryBundle } from "@/core/domain/repositories/RepositoryBundle";

function createInternalAccessRequest(): Request {
  // Internal synthetic request used for server-side page access checks.
  // No route URL coupling required; auth resolution is based on headers/env.
  return new Request("http://internal.local/");
}

export async function validateAdminLayoutAccess(request: Request, repositories: RepositoryBundle): Promise<void> {
  await requireAdministrator(request, repositories);
}

export async function evaluateAdminLayoutAccess(
  request: Request,
  repositories: RepositoryBundle
): Promise<{ status: number; redirectTo?: string }> {
  try {
    await validateAdminLayoutAccess(request, repositories);
    return { status: 200 };
  } catch (error: unknown) {
    if (error instanceof AppError && error.status === 401) {
      return { status: 302, redirectTo: "/login?returnUrl=/admin/users" };
    }
    if (error instanceof AppError && error.status === 403) {
      return { status: 403, redirectTo: "/dashboard" };
    }
    throw error;
  }
}

export async function evaluateAdminUsersRouteAccess(
  requestOrRepositories: Request | RepositoryBundle,
  repositoriesMaybe?: RepositoryBundle
): Promise<{ status: number; redirectTo?: string }> {
  if (requestOrRepositories instanceof Request) {
    if (!repositoriesMaybe) {
      throw new Error("repositories is required when first argument is Request");
    }

    return evaluateAdminLayoutAccess(requestOrRepositories, repositoriesMaybe);
  }

  return evaluateAdminLayoutAccess(createInternalAccessRequest(), requestOrRepositories);
}
