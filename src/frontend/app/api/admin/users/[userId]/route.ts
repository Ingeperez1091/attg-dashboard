import { withAdminGuard } from "@/app/api/admin/users/middleware";
import { AppError } from "@/lib/api/error-handler";
import { getRuntimeRepositories } from "@/infrastructure/persistence/runtime/repositories";
import { getContainer } from "@/lib/di/container";
import { updateUserSchema } from "@/lib/validation/admin-users.schema";
import { updateAdminUser } from "./update-user";

/**
 * GET /api/admin/users/{userId}
 * Returns a single user by identifier.
 */
export async function GET(request: Request, context: { params: Promise<{ userId: string }> }): Promise<Response> {
  const { userId } = await context.params;
  const handler = withAdminGuard(async (): Promise<Response> => {
    const container = getContainer();
    const user = await container.userService.getUserById(userId);

    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found.");
    }

    return Response.json(user, { status: 200 });
  }, getRuntimeRepositories);

  return handler(request);
}

/**
 * PUT /api/admin/users/{userId}
 * Updates user active state, role and application associations in one operation.
 */
export async function PUT(request: Request, context: { params: Promise<{ userId: string }> }): Promise<Response> {
  const { userId } = await context.params;
  const handler = withAdminGuard(async (innerRequest, guardContext): Promise<Response> => {
    const payload = await innerRequest.json();
    const parsed = updateUserSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Invalid user update payload.");
    }

    return updateAdminUser({
      userId,
      isActive: parsed.data.isActive,
      roleId: parsed.data.roleId,
      applicationIds: parsed.data.applicationIds,
      actorUserId: guardContext.sessionUserId,
      eventName: "user.update"
    });
  }, getRuntimeRepositories);

  return handler(request);
}
