import { RoleName } from "@/core/domain/entities/Role";
import {
  getRuntimeRepositories,
  resetRuntimeRepositoriesForTests
} from "@/infrastructure/persistence/runtime/repositories";

interface SessionUserOptions {
  role: RoleName;
  applicationIds?: string[];
  isActive?: boolean;
}

export function resetAuthIntegrationState(): void {
  process.env.USE_INMEMORY_REPOSITORY = "true";
  delete process.env.DEV_SESSION_USER_ID;
  resetRuntimeRepositoriesForTests();
}

export async function createSessionUser(options: SessionUserOptions): Promise<string> {
  const repositories = getRuntimeRepositories();
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const user = await repositories.users.create({
    username: `integration_auth_user_${suffix}`,
    email: `integration_auth_user_${suffix}@example.com`,
    displayName: `Integration Auth User ${suffix}`,
    isActive: options.isActive ?? true,
    actorUserId: "seed"
  });

  await repositories.roles.assignRole(user.userId, options.role, "seed");

  for (const applicationId of options.applicationIds ?? []) {
    await repositories.userApplications.assign(user.userId, applicationId, "seed");
  }

  return user.userId;
}

export function bearerHeaders(userId: string): HeadersInit {
  return { Authorization: `Bearer ${userId}` };
}
