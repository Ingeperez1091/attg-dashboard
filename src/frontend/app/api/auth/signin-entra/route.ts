import { signIn } from "@/auth";
import { NextRequest } from "next/server";

function getReturnUrl(rawValue: string | null): string {
  if (!rawValue || !rawValue.startsWith("/") || rawValue.startsWith("//")) {
    return "/";
  }
  return rawValue;
}

export async function POST(request: NextRequest): Promise<Response> {
  const formData = await request.formData();
  const returnUrl = getReturnUrl(formData.get("returnUrl") as string | null);
  return signIn("microsoft-entra-id", { redirectTo: returnUrl });
}
