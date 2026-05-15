import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isDevBypassEnabled } from "@/lib/auth/dev-bypass";

function getCanonicalOrigin(origin: string): string {
  const configured = process.env.AUTH_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // Fall back to request origin.
    }
  }

  if (origin.includes("0.0.0.0")) {
    return "http://localhost";
  }

  return origin;
}

function normalizeIisNodePathname(pathname: string): string {
  // IISNode can surface internal named-pipe prefixes such as:
  //   //pipe/<guid>/api/auth/callback/...
  // Normalize these back to application paths before auth routing.
  const pipePrefix = pathname.match(/^\/\/pipe\/[0-9a-fA-F-]{36}(\/.*)?$/);
  if (pipePrefix) {
    return pipePrefix[1] || "/";
  }

  const guidPrefix = pathname.match(/^\/[0-9a-fA-F-]{36}(\/.*)?$/);
  if (guidPrefix) {
    return guidPrefix[1] || "/";
  }

  return pathname;
}

export default auth((request) => {
  const normalizedPath = normalizeIisNodePathname(request.nextUrl.pathname);

  // Never gate native Auth.js endpoints; they must remain publicly reachable.
  if (normalizedPath.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  const devBypassEnabled = isDevBypassEnabled();
  const devBypassUserId = process.env.NODE_ENV !== "production"
    ? request.cookies.get("dev_user_id")?.value
    : undefined;

  if (request.auth || (devBypassEnabled && devBypassUserId)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", getCanonicalOrigin(request.nextUrl.origin));
  const rawReturnUrl = `${normalizedPath}${request.nextUrl.search}`;
  // IISNode can surface internal named-pipe paths (for example //pipe/...) on rewritten requests.
  const safeReturnUrl = rawReturnUrl.startsWith("//") ? "/" : rawReturnUrl;
  loginUrl.searchParams.set("returnUrl", safeReturnUrl);
  return NextResponse.redirect(loginUrl);
});

export const config = {
  matcher: ["/", "/admin/:path*", "/dashboard/:path*", "/filters/:path*"]
};