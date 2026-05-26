import { AppError } from "@/lib/api/error-handler";
import { logUserCreateFailure, logUserCreateSuccess } from "@/lib/api/audit-logger";
import { logMutationEvent } from "@/lib/api/request-logger";
import { logOperationValidationFailure, createOperationContext } from "@/lib/api/operation-logger";
import { withAdminGuard } from "@/app/api/admin/users/middleware";
import { getRuntimeRepositories } from "@/infrastructure/persistence/runtime/repositories";
import { getContainer } from "@/lib/di/container";
import { createUserSchema } from "@/lib/validation/admin-users.schema";

/**
 * GET /api/admin/users
 * Returns user list; includeInactive query flag controls inactive visibility.
 */
export const GET = withAdminGuard(async (request): Promise<Response> => {
  const container = getContainer();
  const url = new URL(request.url);
  const includeInactive = url.searchParams.get("includeInactive") === "true";
  const rawUsers = await container.userService.listUsers(includeInactive);

  const users = await Promise.all(
    rawUsers.map(async (user) => {
      const role = await container.userService.getUserRoleByUserId(user.userId);
      const applications = await container.userService.getUserApplicationsByUserId(user.userId);
      return {
        userId: user.userId,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        azureAdObjectId: user.azureAdObjectId,
        role,
        applications,
        isActive: user.isActive,
        createDate: user.createDate,
        createdBy: user.createdBy,
        updateDate: user.updateDate,
        updatedBy: user.updatedBy
      };
    })
  );

  return Response.json({ users }, { status: 200 });
}, getRuntimeRepositories);

/**
 * POST /api/admin/users
 * Creates a user after payload validation and emits audit events for success/failure.
 */
export const POST = withAdminGuard(async (request, context): Promise<Response> => {
  const container = getContainer();
  const payload = await request.json();
  const parsed = createUserSchema.safeParse(payload);

  if (!parsed.success) {
    const failures = parsed.error.errors.map((e) => ({
      field: e.path.join(".") || "request",
      message: e.message
    }));
    const opCtx = createOperationContext(request, context.sessionUserId);
    logOperationValidationFailure(opCtx, failures);
    logUserCreateFailure(parsed.error.errors[0]?.message ?? "Validation failed.", context.sessionUserId, payload);
    throw new AppError(400, "VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Invalid request body.");
  }

  const created = await (async () => {
    try {
      return await container.userService.createUserWithAssociations({
        username: parsed.data.username,
        email: parsed.data.email,
        displayName: parsed.data.displayName,
        isActive: parsed.data.isActive,
        roleId: parsed.data.roleId,
        applicationIds: parsed.data.applicationIds ?? [],
        actorUserId: context.sessionUserId
      });
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : "User creation failed.";
      logUserCreateFailure(reason, context.sessionUserId, parsed.data);
      throw error;
    }
  })();

  logUserCreateSuccess(created.userId, created.email, context.sessionUserId);
  logMutationEvent("user.create", context.sessionUserId, {
    userId: created.userId,
    email: created.email,
    isActive: created.isActive
  });

  return Response.json(created, { status: 201 });
}, getRuntimeRepositories);
