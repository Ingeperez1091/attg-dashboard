import { NextResponse } from "next/server";
import { verifySessionToken , createSessionToken } from "@/lib/auth/session-token";
import { getRuntimeRepositories } from "@/infrastructure/persistence/runtime/repositories";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/api/rate-limit";
import { logRateLimitEvent } from "@/lib/api/security-audit";

/**
 * POST /api/auth/verify
 *
 * Verifies the current Bearer token and returns user info.
 * If ?refresh=1 is present, re-issues a fresh token (for silent refresh).
 * No cookies are used — authentication is purely via the Authorization header.
 */
export async function POST(request: Request) {
  const clientIp = getClientIp(request);
  const rateCheck = checkRateLimit(`auth-verify:${clientIp}`, { maxRequests: 30, windowMs: 60_000 });
  if (!rateCheck.allowed) {
    logRateLimitEvent(request, "auth-verify");
    return rateLimitedResponse(rateCheck);
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing Authorization header" }, { status: 401 });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return NextResponse.json({ error: "Empty token" }, { status: 401 });
  }

  const payload = verifySessionToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  // Verify user still exists and is active
  const repositories = getRuntimeRepositories();
  const user = await repositories.users.findById(payload.userId);
  if (!user?.isActive) {
    return NextResponse.json({ error: "User not found or inactive" }, { status: 403 });
  }

  const role = await repositories.roles.getRoleByUserId(payload.userId);
  const effectiveRole = role ?? "viewer";
  const applications = await repositories.userApplications.listByUserId(payload.userId);

  const url = new URL(request.url);
  const shouldRefresh = url.searchParams.get("refresh") === "1";

  const response: Record<string, unknown> = {
    user: {
      userId: payload.userId,
      role: effectiveRole,
      isActive: user.isActive,
      email: payload.email ?? null,
    },
  };

  if (shouldRefresh) {
    response.token = createSessionToken({
      userId: payload.userId,
      role: effectiveRole,
      isActive: user.isActive,
      applications,
      oid: payload.oid,
      email: payload.email,
    });
  }

  return NextResponse.json(response);
}
