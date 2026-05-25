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

export function resetAuthContractState(): void {
  process.env.USE_INMEMORY_REPOSITORY = "true";
  delete process.env.DEV_SESSION_USER_ID;
  resetRuntimeRepositoriesForTests();
}

export async function createSessionUser(options: SessionUserOptions): Promise<string> {
  const repositories = getRuntimeRepositories();
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const user = await repositories.users.create({
    username: `auth_user_${suffix}`,
    email: `auth_user_${suffix}@example.com`,
    displayName: `Auth User ${suffix}`,
    isActive: options.isActive ?? true,
    actorUserId: "seed"
  });

  await repositories.roles.assignRole(user.userId, options.role, "seed");

  for (const applicationId of options.applicationIds ?? []) {
    await repositories.userApplications.assign(user.userId, applicationId, "seed");
  }

  return user.userId;
}

/**
 * Returns headers that authenticate via the dev_user_id cookie.
 * Only works when dev bypass is enabled (NODE_ENV !== "production").
 */
export function bearerHeaders(userId: string): HeadersInit {
  return { Cookie: `dev_user_id=${userId}` };
}
