import { verifySessionToken, SessionTokenPayload } from "@/lib/auth/session-token";
import { RepositoryBundle } from "@/core/domain/repositories/RepositoryBundle";
import { SessionEntity } from "@/core/domain/entities/SessionEntity";
import { assertCanonicalRole } from "@/lib/auth/authorization";
import { appBootTrace } from "@/lib/runtime-trace";
import { logAuthFailureEvent } from "@/lib/api/security-audit";

/**
 * Extracts and verifies a Bearer token from the Authorization header.
 * Returns a fully-resolved SessionEntity or null if the token is invalid/missing.
 */
export async function resolveFromBearerToken(
  request: Request,
  repositories: RepositoryBundle
): Promise<SessionEntity | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  appBootTrace("bearer-token:verify:start");

  let payload: SessionTokenPayload | null;
  try {
    payload = verifySessionToken(token);
  } catch {
    appBootTrace("bearer-token:verify:error");
    logAuthFailureEvent(request, "token_verification_error");
    return null;
  }

  if (!payload) {
    appBootTrace("bearer-token:verify:invalid");
    logAuthFailureEvent(request, "invalid_or_expired_token");
    return null;
  }

  // Verify user still exists and is active in the database
  const user = await repositories.users.findById(payload.userId);
  if (!user) {
    appBootTrace("bearer-token:verify:user-not-found", { userId: payload.userId });
    logAuthFailureEvent(request, "user_not_found", payload.userId);
    return null;
  }

  const role = await repositories.roles.getRoleByUserId(payload.userId);
  const effectiveRole = role ?? "viewer";
  assertCanonicalRole(effectiveRole);

  const applications = await repositories.userApplications.listByUserId(payload.userId);

  appBootTrace("bearer-token:verify:success", { userId: payload.userId });

  return {
    userId: payload.userId,
    role: effectiveRole,
    isActive: user.isActive,
    applications,
  };
}
