import { getContainer } from "@/lib/di/container";

export async function GET(request: Request): Promise<Response> {
  const includeInactive = new URL(request.url).searchParams.get("includeInactive") === "true";
  const users = await getContainer().userService.listUsers(includeInactive);
  return Response.json({ users }, { status: 200 });
}

export async function POST(request: Request): Promise<Response> {
  const payload = await request.json();
  const actorUserId = process.env.DEV_SESSION_USER_ID ?? "system";

  const created = await getContainer().userService.createUser({
    username: String(payload.username ?? "").trim(),
    email: String(payload.email ?? "").trim().toLowerCase(),
    displayName: payload.displayName ? String(payload.displayName) : undefined,
    isActive: payload.isActive !== false,
    actorUserId
  });

  return Response.json(created, { status: 201 });
}
