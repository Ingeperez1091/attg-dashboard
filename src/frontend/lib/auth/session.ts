import { AppError } from "@/lib/api/error-handler";
import { RepositoryBundle } from "@/core/domain/repositories/RepositoryBundle";
import { RoleName } from "@/core/domain/entities/Role";
import { SessionEntity as SessionUser } from "@/core/domain/entities/SessionEntity";
import { assertCanonicalRole } from "@/lib/auth/authorization";
import { logSsoIdentityBindSuccess } from "@/lib/api/audit-logger";
import { isDevBypassEnabled } from "@/lib/auth/dev-bypass";
import { appBootTrace } from "@/lib/runtime-trace";

function isSsoDebugEnabled(): boolean {
  return process.env.AUTH_DEBUG_SSO === "true";
}

function mask(value: string | null | undefined): string {
  if (!value) {
    return "none";
  }

  if (value.length <= 8) {
    return "********";
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function logSsoDebug(message: string, context?: Record<string, unknown>): void {
  if (!isSsoDebugEnabled()) {
    return;
  }

  if (context) {
    console.info(`[auth:sso] ${message}`, context);
    return;
  }

  console.info(`[auth:sso] ${message}`);
}

function parseBearerUserId(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, value] = authorizationHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !value) {
    return null;
  }

  return value.trim();
}

function parseCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  const entries = cookieHeader.split(";");
  for (const entry of entries) {
    const [rawName, ...rawValue] = entry.trim().split("=");
    if (rawName !== name) {
      continue;
    }

    const value = rawValue.join("=").trim();
    return value || null;
  }

  return null;
}

function seededAdminSession(userId: string): SessionUser {
  return {
    userId,
    role: "administrator",
    isActive: true,
    applications: ["*"]
  };
}

async function resolveFromRepositories(userId: string, repositories: RepositoryBundle): Promise<SessionUser | null> {
  appBootTrace("session:resolveFromRepositories:start", { userId });
  const user = await repositories.users.findById(userId);
  if (!user) {
    appBootTrace("session:resolveFromRepositories:no-user", { userId });
    return null;
  }

  const role = await repositories.roles.getRoleByUserId(userId);
  const effectiveRole = (role ?? "viewer") as string;
  assertCanonicalRole(effectiveRole);

  const applications = await repositories.userApplications.listByUserId(userId);

  appBootTrace("session:resolveFromRepositories:success", {
    userId,
    role: effectiveRole,
    isActive: user.isActive,
    applications: applications.length
  });

  return {
    userId,
    role: effectiveRole as RoleName,
    isActive: user.isActive,
    applications
  };
}

function extractSessionOid(session: unknown): string | null {
  if (!session || typeof session !== "object") {
    return null;
  }

  const oid = (session as { oid?: unknown }).oid;
  return typeof oid === "string" && oid.trim() ? oid.trim() : null;
}

function extractSessionEmail(session: unknown): string | null {
  if (!session || typeof session !== "object") {
    return null;
  }

  const user = (session as { user?: unknown }).user;
  if (!user || typeof user !== "object") {
    return null;
  }

  const email = (user as { email?: unknown }).email;
  return typeof email === "string" && email.trim() ? email.trim().toLowerCase() : null;
}

async function resolveFromAuthSession(repositories: RepositoryBundle): Promise<SessionUser | null> {
  appBootTrace("session:resolveFromAuthSession:start");
  let authSession: unknown;
  try {
    const authModule = await import("@/auth");
    authSession = await authModule.auth();
    appBootTrace("session:resolveFromAuthSession:auth-loaded");
  } catch {
    logSsoDebug("Auth.js session import or resolution failed.");
    appBootTrace("session:resolveFromAuthSession:auth-failed");
    return null;
  }
  const oid = extractSessionOid(authSession);
  const email = extractSessionEmail(authSession);

  if (oid) {
    appBootTrace("session:resolveFromAuthSession:oid-found", { oid: mask(oid) });
    const byOid = await repositories.users.findByAzureAdObjectId(oid);
    if (byOid) {
      logSsoDebug("Resolved user by AzureADObjectId.", {
        userId: byOid.userId,
        oid: mask(oid)
      });
      appBootTrace("session:resolveFromAuthSession:resolved-by-oid", { userId: byOid.userId });
      return resolveFromRepositories(byOid.userId, repositories);
    }
  } else {
    logSsoDebug("No oid claim found in Auth.js session; continuing with email fallback.");
  }

  if (!email) {
    logSsoDebug("No email claim found in Auth.js session for identity fallback.", {
      oid: mask(oid)
    });
    appBootTrace("session:resolveFromAuthSession:no-email", { oid: mask(oid) });
    return null;
  }

  appBootTrace("session:resolveFromAuthSession:email-fallback", { email: mask(email), oid: mask(oid) });
  const users = await repositories.users.list(true);
  const byEmail = users.find((candidate) => candidate.email.toLowerCase() === email);

  if (!byEmail) {
    logSsoDebug("No local user matched SSO email.", {
      email: mask(email),
      oid: mask(oid)
    });
    appBootTrace("session:resolveFromAuthSession:no-local-user", { email: mask(email), oid: mask(oid) });
    return null;
  }

  if (oid && byEmail.azureAdObjectId && byEmail.azureAdObjectId !== oid) {
    logSsoDebug("Local user has a different AzureADObjectId already bound.", {
      userId: byEmail.userId,
      email: mask(email),
      existingOid: mask(byEmail.azureAdObjectId),
      incomingOid: mask(oid)
    });
    appBootTrace("session:resolveFromAuthSession:oid-mismatch", { userId: byEmail.userId, email: mask(email) });
    return null;
  }

  if (oid && !byEmail.azureAdObjectId) {
    logSsoDebug("Attempting first-time AzureADObjectId bind by email.", {
      userId: byEmail.userId,
      email: mask(email),
      oid: mask(oid)
    });
    const bound = await repositories.users.bindAzureAdObjectId(byEmail.userId, oid, byEmail.userId);
    if (bound) {
      logSsoIdentityBindSuccess(bound.userId, bound.email, oid);
      logSsoDebug("AzureADObjectId bind succeeded.", {
        userId: bound.userId,
        email: mask(bound.email),
        oid: mask(oid)
      });
    } else {
      logSsoDebug("AzureADObjectId bind returned null.", {
        userId: byEmail.userId,
        email: mask(email),
        oid: mask(oid)
      });
    }
  }

  logSsoDebug("Resolved user by email fallback after identity processing.", {
    userId: byEmail.userId,
    email: mask(email),
    oid: mask(oid)
  });
  appBootTrace("session:resolveFromAuthSession:resolved-by-email", { userId: byEmail.userId });
  return resolveFromRepositories(byEmail.userId, repositories);
}

/**
 * Resolves session when available and returns null for unauthenticated requests.
 */
export async function getOptionalSession(
  request: Request,
  repositories?: RepositoryBundle
): Promise<SessionUser | null> {
  const devBypassEnabled = isDevBypassEnabled();
  appBootTrace("session:getOptionalSession:start", { devBypassEnabled, hasRepositories: Boolean(repositories) });

  if (repositories) {
    const authSession = await resolveFromAuthSession(repositories);
    if (authSession) {
      return authSession;
    }
  }

  const bearerUserId = parseBearerUserId(request.headers.get("Authorization"));
  const cookieUserId = !devBypassEnabled
    ? null
    : parseCookieValue(request.headers.get("Cookie"), "dev_user_id");
  const envUserId = devBypassEnabled ? process.env.DEV_SESSION_USER_ID : undefined;
  const userId = bearerUserId ?? cookieUserId ?? envUserId ?? null;

  if (!userId) {
    logSsoDebug("No fallback user identifier available (bearer/cookie/env).", {
      devBypassEnabled
    });
    appBootTrace("session:getOptionalSession:no-user-id");
    return null;
  }

  if (devBypassEnabled && !bearerUserId && !cookieUserId && envUserId) {
    logSsoDebug("Resolved seeded dev bypass session from DEV_SESSION_USER_ID.", {
      userId: mask(envUserId)
    });
    appBootTrace("session:getOptionalSession:dev-bypass", { userId: mask(envUserId) });
    return seededAdminSession(envUserId);
  }

  if (!repositories) {
    appBootTrace("session:getOptionalSession:missing-repositories", { userId: mask(userId) });
    throw new AppError(500, "INTERNAL_ERROR", "Repository bundle is required for token-based session resolution.");
  }

  appBootTrace("session:getOptionalSession:resolve-from-repositories", { userId: mask(userId) });
  return resolveFromRepositories(userId, repositories);
}

/**
 * Resolves an authenticated session user for the current request.
 * Throws AppError(401) when no session can be derived.
 */
export async function getSessionUser(request: Request, repositories?: RepositoryBundle): Promise<SessionUser> {
  const session = await getOptionalSession(request, repositories);

  if (!session) {
    throw new AppError(401, "UNAUTHORIZED", "No active session.");
  }

  return session;
}
