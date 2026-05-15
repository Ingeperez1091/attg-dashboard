import { withAdminGuard } from "@/app/api/admin/users/middleware";
import { AppError } from "@/lib/api/error-handler";
import { logMutationEvent } from "@/lib/api/request-logger";
import { getRuntimeRepositories } from "@/infrastructure/persistence/runtime/repositories";
import { getContainer } from "@/lib/di/container";
import { assignRoleSchema } from "@/lib/validation/admin-users.schema";

/**
 * PUT /api/admin/users/{userId}/role
 * Validates and replaces the target user's effective role.
 */
export async function PUT(request: Request, context: { params: Promise<{ userId: string }> }): Promise<Response> {
  const { userId } = await context.params;
  const handler = withAdminGuard(async (innerRequest, guardContext): Promise<Response> => {
    const container = getContainer();

    const payload = await innerRequest.json();
    const parsed = assignRoleSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Invalid role payload.");
    }

    const assigned = await container.userService.assignUserRole(
      userId,
      parsed.data.roleId,
      guardContext.sessionUserId
    );

    if (!assigned) {
      throw new AppError(404, "NOT_FOUND", "User not found.");
    }

    logMutationEvent("user.role.assign", guardContext.sessionUserId, {
      userId,
      newRole: parsed.data.roleId
    });

    return Response.json(
      {
        userId,
        roleId: parsed.data.roleId
      },
      { status: 200 }
    );
  }, getRuntimeRepositories);

  return handler(request);
}
