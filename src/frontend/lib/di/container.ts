import { ApplicationService } from "@/core/application/services/ApplicationService";
import { AuthService } from "@/core/application/services/AuthService";
import { RoleService } from "@/core/application/services/RoleService";
import { UserService } from "@/core/application/services/UserService";
import { getRuntimeRepositories } from "@/infrastructure/persistence/runtime/repositories";

export interface Container {
  userService: UserService;
  roleService: RoleService;
  applicationService: ApplicationService;
  authService: AuthService;
}

export function createContainer(): Container {
  const repositories = getRuntimeRepositories();

  return {
    userService: new UserService(repositories.users, repositories.roles, repositories.applications),
    roleService: new RoleService(repositories.roles),
    applicationService: new ApplicationService(repositories.applications),
    authService: new AuthService(repositories.users, repositories.roles)
  };
}

export function getContainer(): Container {
  return createContainer();
}
