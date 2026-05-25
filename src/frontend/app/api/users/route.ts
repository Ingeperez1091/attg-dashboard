import { withAdminGuard } from "@/app/api/admin/users/middleware";
import { getRuntimeRepositories } from "@/infrastructure/persistence/runtime/repositories";
import { getContainer } from "@/lib/di/container";

export const GET = withAdminGuard(async (request): Promise<Response> => {
  const includeInactive = new URL(request.url).searchParams.get("includeInactive") === "true";
  const users = await getContainer().userService.listUsers(includeInactive);
  return Response.json({ users }, { status: 200 });
}, getRuntimeRepositories);

export const POST = withAdminGuard(async (request, context): Promise<Response> => {
  const payload = await request.json();

  const created = await getContainer().userService.createUser({
    username: String(payload.username ?? "").trim(),
    email: String(payload.email ?? "").trim().toLowerCase(),
    displayName: payload.displayName ? String(payload.displayName) : undefined,
    isActive: payload.isActive !== false,
    actorUserId: context.sessionUserId
  });

  return Response.json(created, { status: 201 });
}, getRuntimeRepositories);
