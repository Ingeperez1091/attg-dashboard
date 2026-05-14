import { withAdminGuard } from "@/app/api/admin/users/middleware";
import { AppError } from "@/lib/api/error-handler";
import { logMutationEvent } from "@/lib/api/request-logger";
import { getRuntimeRepositories } from "@/infrastructure/persistence/runtime/repositories";
import { getContainer } from "@/lib/di/container";
import { assignApplicationSchema } from "@/lib/validation/admin-users.schema";

/**
 * GET /api/admin/users/{userId}/applications
 * Returns application assignments for the target user.
 */
export async function GET(request: Request, context: { params: Promise<{ userId: string }> }): Promise<Response> {
  const { userId } = await context.params;
  const handler = withAdminGuard(async (): Promise<Response> => {
    const container = getContainer();
    const applications = await container.userService.listUserApplications(userId);
    if (!applications) {
      throw new AppError(404, "NOT_FOUND", "User not found.");
    }

    return Response.json({ userId, applications }, { status: 200 });
  }, getRuntimeRepositories);

  return handler(request);
}

/**
 * POST /api/admin/users/{userId}/applications
 * Assigns one application or all applications for the target user.
 */
export async function POST(request: Request, context: { params: Promise<{ userId: string }> }): Promise<Response> {
  const { userId } = await context.params;
  const handler = withAdminGuard(async (innerRequest, guardContext): Promise<Response> => {
    const container = getContainer();

    const payload = await innerRequest.json();
    const parsed = assignApplicationSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Invalid application payload.");
    }

    const assigned = await container.userService.assignUserApplications(userId, {
      all: parsed.data.all,
      applicationId: parsed.data.applicationId,
      actorUserId: guardContext.sessionUserId
    });

    if (!assigned) {
      throw new AppError(404, "NOT_FOUND", "User not found.");
    }

    logMutationEvent("user.applications.assign", guardContext.sessionUserId, {
      userId,
      assigned
    });

    return Response.json({ userId, assigned }, { status: 201 });
  }, getRuntimeRepositories);

  return handler(request);
}
