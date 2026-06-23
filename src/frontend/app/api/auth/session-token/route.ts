import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getRuntimeRepositories } from "@/infrastructure/persistence/runtime/repositories";
import { createSessionToken } from "@/lib/auth/session-token";
import { createSessionIdCookieValue, SESSION_ID_COOKIE_NAME } from "@/lib/auth/session-cookie";
import { appBootTrace } from "@/lib/runtime-trace";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/api/rate-limit";
import { logCsrfRejectedEvent, logRateLimitEvent } from "@/lib/api/security-audit";

/**
 * Validates the request Origin header against the configured AUTH_URL.
 * Prevents cross-site request forgery on the token acquisition endpoint.
 */
function verifyOrigin(request: Request): boolean {
  const origin = request.headers.get("Origin");
  const expectedBase = process.env.AUTH_URL?.trim();

  // In development without AUTH_URL, allow requests
  if (!expectedBase && process.env.NODE_ENV !== "production") {
    return true;
  }

  // If no AUTH_URL is configured in production, deny
  if (!expectedBase) {
    return false;
  }

  let expectedOrigin: string;
  try {
    expectedOrigin = new URL(expectedBase).origin;
  } catch {
    return false;
  }

  // Check Origin header (present on POST fetch requests)
  if (origin) {
    return origin === expectedOrigin;
  }

  // Some same-origin requests omit Origin; check Referer as fallback
  const referer = request.headers.get("Referer");
  if (referer) {
    try {
      return new URL(referer).origin === expectedOrigin;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * POST /api/auth/session-token
 *
 * Called by the client immediately after OAuth login completes.
 * Reads the Auth.js session from the cookie (which WAF hasn't blocked yet at this point)
 * and returns an encrypted signed token that the client stores in sessionStorage.
 * All subsequent API calls use this token as a Bearer header, avoiding WAF cookie conflicts.
 *
 * Uses POST (not GET) to ensure browsers include the Origin header for CSRF verification.
 * Rate-limited: max 10 requests per minute per IP to prevent token farming.
 */

async function resolveUserId(oid: string | undefined, email: string | undefined): Promise<string | null> {
  const repositories = getRuntimeRepositories();

  if (oid) {
    const byOid = await repositories.users.findByAzureAdObjectId(oid);
    if (byOid) return byOid.userId;
  }

  if (email) {
    const users = await repositories.users.list(true);
    const byEmail = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (byEmail) return byEmail.userId;
  }

  return null;
}

export async function POST(request: Request) {
  // CSRF protection: verify the request comes from our own origin
  if (!verifyOrigin(request)) {
    appBootTrace("api:session-token:origin-rejected", {
      origin: request.headers.get("Origin") ?? "none",
    });
    logCsrfRejectedEvent(request, request.headers.get("Origin"));
    return NextResponse.json(
      { error: "FORBIDDEN", message: "Invalid request origin." },
      { status: 403 }
    );
  }

  const clientIp = getClientIp(request);
  const rateCheck = checkRateLimit(`session-token:${clientIp}`, { maxRequests: 10, windowMs: 60_000 });
  if (!rateCheck.allowed) {
    logRateLimitEvent(request, "session-token");
    return rateLimitedResponse(rateCheck);
  }

  appBootTrace("api:session-token:start");

  // In dev mode with dev bypass enabled, allow cookie-based session resolution
  // so e2e tests and local dev bypass work with the sessionStorage auth flow.
  const devBypassEnabled = process.env.NODE_ENV !== "production"
    && process.env.ENABLE_DEV_BYPASS !== "false";
  const devUserId = devBypassEnabled
    ? request.headers.get("Cookie")?.match(/(?:^|;\s*)dev_user_id=([^;]+)/)?.[1] ?? null
    : null;

  let sessionOid: string | undefined;
  let sessionEmail: string | undefined;
  let resolvedUserId: string | null = null;

  if (devUserId) {
    // Dev bypass: use the dev_user_id cookie directly
    resolvedUserId = devUserId;
  } else {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    sessionOid = (session as { oid?: string }).oid;
    sessionEmail = (session as { user?: { email?: string } }).user?.email;

    if (!sessionOid && !sessionEmail) {
      return NextResponse.json({ error: "No identity claims in session" }, { status: 401 });
    }

    resolvedUserId = await resolveUserId(sessionOid, sessionEmail);
  }

  if (!resolvedUserId) {
    return NextResponse.json({ error: "User not found" }, { status: 403 });
  }

  const repositories = getRuntimeRepositories();
  const role = await repositories.roles.getRoleByUserId(resolvedUserId);
  const effectiveRole = role ?? "viewer";
  const applications = await repositories.userApplications.listByUserId(resolvedUserId);
  const user = await repositories.users.findById(resolvedUserId);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 403 });
  }

  const token = createSessionToken({
    userId: resolvedUserId,
    role: effectiveRole,
    isActive: user.isActive,
    applications,
    oid: sessionOid ?? undefined,
    email: sessionEmail ?? user.email,
  });

  appBootTrace("api:session-token:success", { userId: resolvedUserId });

  const response = NextResponse.json({
    token,
    user: {
      userId: resolvedUserId,
      role: effectiveRole,
      isActive: user.isActive,
      email: sessionEmail ?? user.email,
    },
  });

  // Clear the Auth.js session cookie after successful token exchange.
  // The Bearer token in sessionStorage is the canonical auth mechanism going forward;
  // keeping the session cookie around causes WAF issues due to its size.
  const cookieName = process.env.NODE_ENV === "production"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";
  response.cookies.set(cookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/api/auth",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });

  // Set a lightweight HMAC-signed session identifier cookie at path "/".
  // This allows server components to identify the user on page requests
  // without the large Auth.js JWT cookie (~80 bytes vs ~600 bytes).
  response.cookies.set(SESSION_ID_COOKIE_NAME, createSessionIdCookieValue(resolvedUserId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 24 * 60 * 60, // 24 hours — matches Auth.js session maxAge
  });

  return response;
}
