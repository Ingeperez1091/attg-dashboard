import { NextResponse } from "next/server";
import { consumeAuthCode } from "@/lib/auth/auth-code-store";
import { getRuntimeRepositories } from "@/infrastructure/persistence/runtime/repositories";
import { createSessionToken } from "@/lib/auth/session-token";
import { appBootTrace } from "@/lib/runtime-trace";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/api/rate-limit";
import { logRateLimitEvent } from "@/lib/api/security-audit";

/**
 * POST /api/auth/exchange
 *
 * Exchanges a one-time auth code (received via redirect after OAuth callback)
 * for an encrypted Bearer token stored in sessionStorage.
 * No cookies are needed — the code itself proves the user completed OAuth.
 *
 * Body: { "code": "<64-char hex string>" }
 */

async function resolveUserId(oid: string | null, email: string | null): Promise<string | null> {
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
  const clientIp = getClientIp(request);
  const rateCheck = checkRateLimit(`auth-exchange:${clientIp}`, { maxRequests: 10, windowMs: 60_000 });
  if (!rateCheck.allowed) {
    logRateLimitEvent(request, "auth-exchange");
    return rateLimitedResponse(rateCheck);
  }

  let code: string;
  try {
    const body = await request.json();
    code = typeof body?.code === "string" ? body.code.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!code?.length || code.length !== 64 || !/^[0-9a-f]+$/.test(code)) {
    return NextResponse.json({ error: "Invalid auth code" }, { status: 400 });
  }

  const claims = consumeAuthCode(code);
  if (!claims) {
    appBootTrace("api:auth-exchange:invalid-code");
    return NextResponse.json({ error: "Invalid or expired auth code" }, { status: 401 });
  }

  const { oid, email } = claims;
  if (!oid && !email) {
    return NextResponse.json({ error: "No identity claims" }, { status: 401 });
  }

  const userId = await resolveUserId(oid, email);

  if (!userId) {
    return NextResponse.json({ error: "User not found" }, { status: 403 });
  }

  const repositories = getRuntimeRepositories();
  const role = await repositories.roles.getRoleByUserId(userId);
  const effectiveRole = role ?? "viewer";
  const applications = await repositories.userApplications.listByUserId(userId);
  const user = await repositories.users.findById(userId);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 403 });
  }

  const token = createSessionToken({
    userId,
    role: effectiveRole,
    isActive: user.isActive,
    applications,
    oid: oid ?? undefined,
    email: email ?? undefined,
  });

  appBootTrace("api:auth-exchange:success", { userId });

  return NextResponse.json({
    token,
    user: {
      userId,
      role: effectiveRole,
      isActive: user.isActive,
      email: email ?? null,
    },
  });
}
