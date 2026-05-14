import { NextResponse } from "next/server";
import { getRuntimeRepositories } from "@/infrastructure/persistence/runtime/repositories";

function sanitizeReturnUrl(rawValue: string | null): string {
  if (!rawValue || !rawValue.startsWith("/")) {
    return "/";
  }

  return rawValue;
}

function buildLoginRedirect(request: Request, returnUrl: string, errorCode: string): NextResponse {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("returnUrl", returnUrl);
  loginUrl.searchParams.set("error", errorCode);
  return NextResponse.redirect(loginUrl);
}

export async function POST(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const formData = await request.formData();
  const identifier = String(formData.get("identifier") ?? "").trim().toLowerCase();
  const returnUrl = sanitizeReturnUrl(String(formData.get("returnUrl") ?? "/"));

  if (!identifier) {
    return buildLoginRedirect(request, returnUrl, "DEV_IDENTIFIER_REQUIRED");
  }

  const repositories = getRuntimeRepositories();
  const users = await repositories.users.list(true);
  const matched = users.find((user) => {
    const normalizedEmail = user.email.toLowerCase();
    const normalizedUsername = user.username.toLowerCase();
    const normalizedUserId = user.userId.toLowerCase();
    return normalizedEmail === identifier || normalizedUsername === identifier || normalizedUserId === identifier;
  });

  if (!matched) {
    return buildLoginRedirect(request, returnUrl, "DEV_USER_NOT_FOUND");
  }

  if (!matched.isActive) {
    return buildLoginRedirect(request, returnUrl, "DEV_USER_INACTIVE");
  }

  const response = NextResponse.redirect(new URL(returnUrl, request.url));
  response.cookies.set("dev_user_id", matched.userId, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8
  });

  return response;
}