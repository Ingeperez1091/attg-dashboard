import { getContainer } from "@/lib/di/container";
import { getRuntimeRepositories } from "@/infrastructure/persistence/runtime/repositories";
import { evaluateAdminUsersRouteAccess } from "@/lib/auth/admin-access";
import { AdminUserDto } from "@/core/application/dto/admin/AdminUserDto";
import { ApplicationPickerOptionDto } from "@/core/application/dto/applications/ApplicationOptionDto";
import { UsersPageClient } from "@/app/admin/users/components/users-page-client";
import { ReactElement } from "react";

async function mapAdminUsers(container: ReturnType<typeof getContainer>, users: Awaited<ReturnType<typeof container.userService.listUsers>>): Promise<AdminUserDto[]> {
  const withDetails = await Promise.all(
    users.map(async (user) => {
      const role = await container.userService.getUserRoleByUserId(user.userId);
      const applications = await container.userService.getUserApplicationsByUserId(user.userId);

      return {
        userId: user.userId,
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
      } satisfies AdminUserDto;
    })
  );

  return withDetails;
}

async function renderAdminUsersPage(): Promise<ReactElement> {
  const container = getContainer();
  const access = await evaluateAdminUsersRouteAccess(getRuntimeRepositories());

  if (access.status !== 200) {
    return <section>Unauthorized</section>;
  }

  const [users, availableApplications, availableRoles] = await Promise.all([
    container.userService.listUsers(true),
    container.applicationService.listActiveApplications(),
    container.roleService.listRoles()
  ]);

  const mappedUsers = await mapAdminUsers(container, users);
  const applicationOptions: ApplicationPickerOptionDto[] = availableApplications.map((app) => ({
    applicationId: app.applicationId,
    name: app.applicationName,
    description: app.description
  }));

  return (
    <UsersPageClient
      initialUsers={mappedUsers}
      availableApplications={applicationOptions}
      availableRoles={availableRoles}
      currentUserRole="administrator"
    />
  );
}

export default async function AdminUsersPage(): Promise<ReactElement> {
  return renderAdminUsersPage();
}
