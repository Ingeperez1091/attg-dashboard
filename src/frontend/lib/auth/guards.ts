import { AppError } from "@/lib/api/error-handler";
import { getSessionUser } from "@/lib/auth/session";
import { assertActiveSession } from "@/lib/auth/authorization";
import { RepositoryBundle } from "@/core/domain/repositories/RepositoryBundle";
import { SessionEntity as SessionUser } from "@/core/domain/entities/SessionEntity";

/**
 * Requires the request to resolve to an authenticated session.
 */
export async function requireAuthenticated(request: Request, repositories?: RepositoryBundle): Promise<SessionUser> {
  return getSessionUser(request, repositories);
}

/**
 * Requires an authenticated and active session user.
 * Throws AppError(403) when the user is inactive.
 */
export async function requireActive(request: Request, repositories?: RepositoryBundle): Promise<SessionUser> {
  const session = await requireAuthenticated(request, repositories);
  assertActiveSession(session);

  return session;
}

/**
 * Requires an authenticated active administrator session.
 * Throws AppError(403) when caller role is not administrator.
 */
export async function requireAdministrator(request: Request, repositories?: RepositoryBundle): Promise<SessionUser> {
  const session = await requireActive(request, repositories);
  if (session.role !== "administrator") {
    throw new AppError(403, "FORBIDDEN", "Administrator role required.");
  }

  return session;
}

/**
 * Attempts to resolve an authenticated session and returns null when unavailable.
 */
export async function allowOptional(request: Request, repositories?: RepositoryBundle): Promise<SessionUser | null> {
  try {
    return await requireAuthenticated(request, repositories);
  } catch {
    return null;
  }
}
