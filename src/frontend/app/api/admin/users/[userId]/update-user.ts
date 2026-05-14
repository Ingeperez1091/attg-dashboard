import { AppError } from "@/lib/api/error-handler";
import { logMutationEvent } from "@/lib/api/request-logger";
import { getContainer } from "@/lib/di/container";
import { RoleName } from "@/core/domain/entities/Role";

interface UpdateUserRouteInput {
  userId: string;
  actorUserId: string;
  isActive: boolean;
  roleId?: RoleName;
  applicationIds?: string[];
  eventName: "user.update";
}

export async function updateAdminUser(input: UpdateUserRouteInput): Promise<Response> {
  const container = getContainer();
  const targetUser = await container.userService.getUserById(input.userId);

  if (!targetUser) {
    throw new AppError(404, "NOT_FOUND", "User not found.");
  }

  const roleId = input.roleId ?? (await container.userService.getUserRoleByUserId(input.userId));
  const applicationIds = input.applicationIds ?? (await container.userService.getUserApplicationsByUserId(input.userId));

  if (input.isActive === false && roleId === "administrator") {
    const activeAdminCount = await container.userService.countActiveByRole("administrator");
    if (activeAdminCount <= 1) {
      throw new AppError(409, "CONFLICT", "Cannot deactivate the last active administrator.");
    }
  }

  const updated = await container.userService.updateUserWithAssociations({
    userId: input.userId,
    isActive: input.isActive,
    roleId,
    applicationIds,
    actorUserId: input.actorUserId
  });

  if (!updated) {
    throw new AppError(404, "NOT_FOUND", "User not found.");
  }

  logMutationEvent(input.eventName, input.actorUserId, {
    userId: input.userId,
    previousIsActive: targetUser.isActive,
    newIsActive: updated.isActive,
    roleId,
    applicationIds
  });

  return Response.json(updated, { status: 200 });
}