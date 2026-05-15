import { SessionEntity } from "@/core/domain/entities/SessionEntity";
import { AppError } from "@/lib/api/error-handler";

const CANONICAL_ROLES: ReadonlySet<SessionEntity["role"]> = new Set([
  "administrator",
  "application_owner",
  "viewer"
]);

function hasApplicationScope(session: SessionEntity, applicationId: string): boolean {
  return session.applications.includes("*") || session.applications.includes(applicationId);
}

export function assertCanonicalRole(role: string): asserts role is SessionEntity["role"] {
  if (!CANONICAL_ROLES.has(role as SessionEntity["role"])) {
    throw new AppError(403, "FORBIDDEN", "Invalid role assignment.");
  }
}

export function assertActiveSession(session: SessionEntity): void {
  if (!session.isActive) {
    throw new AppError(403, "FORBIDDEN", "User is inactive.");
  }
}

export function assertApplicationScope(
  session: SessionEntity,
  applicationId: string,
  message = "Insufficient permissions for this application."
): void {
  if (!hasApplicationScope(session, applicationId)) {
    throw new AppError(403, "FORBIDDEN", message);
  }
}

export function assertOneOfRoles(
  session: SessionEntity,
  allowedRoles: SessionEntity["role"][],
  message = "Insufficient permissions."
): void {
  if (!allowedRoles.includes(session.role)) {
    throw new AppError(403, "FORBIDDEN", message);
  }
}

export function assertCanViewMetricsForApplication(session: SessionEntity, applicationId: string): void {
  assertActiveSession(session);

  if (session.role === "administrator") {
    return;
  }

  assertApplicationScope(session, applicationId, "Insufficient permissions to view metrics for this application.");
}

export function assertCanViewMetricsForRun(session: SessionEntity, applicationId: string): void {
  assertCanViewMetricsForApplication(session, applicationId);
}
