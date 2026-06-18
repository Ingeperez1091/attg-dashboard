import { NextResponse, type NextRequest } from "next/server";
import { appBootTrace } from "@/lib/runtime-trace";
import { logAccessDeniedEvent } from "@/lib/api/security-audit";
import { getOrCreateRequestId } from "@/lib/api/request-id";

function generateCspNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64");
}

function buildCspHeader(nonce: string): string {
  // In development, Next.js React Fast Refresh requires 'unsafe-eval'.
  const isDev = process.env.NODE_ENV === "development";
  const scriptSrc = isDev
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`;

  // style-src is the CSP Level 2 fallback for browsers that don't support
  // style-src-elem / style-src-attr (Level 3).  In modern browsers the
  // granular directives take precedence:
  //   style-src-elem: nonce-gates <style> elements (Next.js applies the nonce)
  //   style-src-attr: allows React inline style={} props
  // In dev, only 'unsafe-inline' is used (no nonce) because browsers ignore
  // 'unsafe-inline' when a nonce is present, which breaks HMR style injection.
  const styleSrcElem = isDev
    ? "style-src-elem 'self' 'unsafe-inline'"
    : `style-src-elem 'self' 'nonce-${nonce}'`;

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    styleSrcElem,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "font-src 'self'",
    "object-src 'none'",
    "worker-src 'self'",
    "child-src 'self'",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

function normalizeIisNodePathname(pathname: string): string {
  // IISNode can surface internal named-pipe prefixes such as:
  //   //pipe/<guid>/api/auth/callback/...
  // Normalize these back to application paths before auth routing.
  appBootTrace("middleware:normalize-pathname", { originalPathname: pathname });
  const pipePrefix = /^\/\/pipe\/[0-9a-fA-F-]{36}(\/.*)?$/.exec(pathname);
  if (pipePrefix) {
    appBootTrace("middleware:matched-pipe-prefix", { pipePrefix: pipePrefix[0] });
    return pipePrefix[1] || "/";
  }

  const guidPrefix = /^\/[0-9a-fA-F-]{36}(\/.*)?$/.exec(pathname);
  if (guidPrefix) {
    appBootTrace("middleware:matched-guid-prefix", { guidPrefix: guidPrefix[0] });
    return guidPrefix[1] || "/";
  }

  return pathname;
}

/**
 * Middleware handles:
 * 1. IISNode path normalization
 * 2. Request ID propagation
 * 3. Passing through /api/auth/* routes unconditionally (OAuth flow)
 * 4. Deny-by-default for /api/* routes — requires Bearer token in Authorization header
 * 5. Allowing page routes through (client-side guards handle page auth)
 */
export default function middleware(request: NextRequest) {
  const normalizedPath = normalizeIisNodePathname(request.nextUrl.pathname);
  appBootTrace("middleware:incoming-request", { pathname: normalizedPath });
  const requestId = getOrCreateRequestId(request.headers.get("x-request-id"));
  const nonce = generateCspNonce();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set("x-csp-nonce", nonce);
  appBootTrace("middleware:request", {
    requestId,
    method: request.method,
    pathname: normalizedPath,
    rawPathname: request.nextUrl.pathname
  });

  // Never gate native Auth.js endpoints; they must remain publicly reachable.
  // Exception: dev-login/dev-logout must NEVER be accessible in production (defense-in-depth).
  if (normalizedPath.startsWith("/api/auth/")) {
    if (normalizedPath.startsWith("/api/auth/dev-") && process.env.NODE_ENV === "production") {
      appBootTrace("middleware:dev-route-blocked-production", { pathname: normalizedPath });
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
      logAccessDeniedEvent(ip, normalizedPath, "Dev auth route accessed in production", requestId);
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Not found." },
        { status: 404, headers: { "x-request-id": requestId } }
      );
    }
    appBootTrace("middleware:allow-auth-route", { pathname: normalizedPath });
    const authResponse = NextResponse.next({ request: { headers: requestHeaders } });
    authResponse.headers.set("Content-Security-Policy", buildCspHeader(nonce));
    return authResponse;
  }

  // Deny-by-default: API routes require a Bearer token in the Authorization header.
  // Individual route handlers perform full token verification and authorization checks.
  // In dev/test mode with DEV_SESSION_USER_ID, allow requests through so route handlers
  // can resolve the dev-bypass session (defense-in-depth only in production).
  if (normalizedPath.startsWith("/api/")) {
    const authHeader = request.headers.get("Authorization");
    const hasBearer = authHeader?.startsWith("Bearer ") && authHeader.length > 7;
    const devCookie = request.cookies.get("dev_user_id")?.value;
    const devBypassActive = process.env.NODE_ENV !== "production"
      && process.env.ENABLE_DEV_BYPASS !== "false"
      && (Boolean(process.env.DEV_SESSION_USER_ID) || Boolean(devCookie));
    if (!hasBearer && !devBypassActive) {
      appBootTrace("middleware:api-denied-no-bearer", { requestId, pathname: normalizedPath });
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
      logAccessDeniedEvent(ip, normalizedPath, "Missing Bearer token in Authorization header", requestId);
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Missing or invalid Authorization header." },
        { status: 401, headers: { "x-request-id": requestId } }
      );
    }
    appBootTrace("middleware:api-bearer-present", { requestId, pathname: normalizedPath });
    const apiResponse = NextResponse.next({ request: { headers: requestHeaders } });
    apiResponse.headers.set("Content-Security-Policy", buildCspHeader(nonce));
    return apiResponse;
  }

  // Page routes pass through — auth is handled client-side (AuthGuard + sessionStorage).
  appBootTrace("middleware:passthrough", {
    requestId,
    pathname: normalizedPath,
  });
  const pageResponse = NextResponse.next({ request: { headers: requestHeaders } });
  pageResponse.headers.set("Content-Security-Policy", buildCspHeader(nonce));
  return pageResponse;
}

export const config = {
  matcher: ["/", "/admin/:path*", "/dashboard/:path*", "/filters/:path*", "/api/:path*"]
};