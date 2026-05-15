import { withAdminGuard } from "@/app/api/admin/users/middleware";
import { AppError } from "@/lib/api/error-handler";
import { logMutationEvent } from "@/lib/api/request-logger";
import { getRuntimeRepositories } from "@/infrastructure/persistence/runtime/repositories";
import { getContainer } from "@/lib/di/container";

/**
 * DELETE /api/admin/users/{userId}/applications/{applicationId}
 * Removes a non-wildcard application assignment from the target user.
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ userId: string; applicationId: string }> }
): Promise<Response> {
  const { userId, applicationId } = await context.params;
  const handler = withAdminGuard(async (_innerRequest, guardContext): Promise<Response> => {
    const container = getContainer();
    const removed = await container.userService.unassignUserApplication(userId, applicationId);

    if (removed === null) {
      throw new AppError(404, "NOT_FOUND", "User not found.");
    }

    if (!removed) {
      throw new AppError(404, "NOT_FOUND", "Assignment not found.");
    }

    logMutationEvent("user.applications.unassign", guardContext.sessionUserId, {
      userId,
      applicationId
    });

    return new Response(null, { status: 204 });
  }, getRuntimeRepositories);

  return handler(request);
}
