import { NextResponse } from "next/server";

function sanitizeReturnUrl(rawValue: string | null): string {
  if (!rawValue || !rawValue.startsWith("/")) {
    return "/login";
  }

  return rawValue;
}

export async function POST(request: Request): Promise<Response> {
  const formData = await request.formData();
  const returnUrl = sanitizeReturnUrl(String(formData.get("returnUrl") ?? "/login"));

  const response = NextResponse.redirect(new URL(returnUrl, request.url));
  response.cookies.set("dev_user_id", "", {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });

  return response;
}