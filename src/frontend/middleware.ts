import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isDevBypassEnabled } from "@/lib/auth/dev-bypass";

export default auth((request) => {
  const devBypassEnabled = isDevBypassEnabled();
  const devBypassUserId = process.env.NODE_ENV !== "production"
    ? request.cookies.get("dev_user_id")?.value
    : undefined;

  if (request.auth || (devBypassEnabled && devBypassUserId)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("returnUrl", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
});

export const config = {
  matcher: ["/", "/admin/:path*", "/dashboard/:path*", "/filters/:path*"]
};