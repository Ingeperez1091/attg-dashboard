import { Role, RoleName } from "@/core/domain/entities/Role";
import { IRoleRepository } from "@/core/domain/repositories/IRoleRepository";
import { createStoreAccessor } from "@/infrastructure/persistence/memory/sharedStore";

const ROLE_DEFINITIONS: Role[] = [
  { roleId: "administrator", roleName: "Administrator", isActive: true },
  { roleId: "application_owner", roleName: "Application Owner", isActive: true },
  { roleId: "viewer", roleName: "Viewer", isActive: true }
];

type RoleRepoStore = {
  rolesByUser: Record<string, RoleName>;
};

const sharedStoreFile = process.env.TEST_ROLE_REPOSITORY_STORE_FILE;

const { getStore, writeStore } = createStoreAccessor<RoleRepoStore>({
  storeFilePath: sharedStoreFile,
  globalKey: "__dashboardRoleRepoStore",
  createEmptyStore: () => ({ rolesByUser: {} })
});

export class RoleMemoryRepository implements IRoleRepository {
  async getRoleNameByUserId(userId: string): Promise<RoleName | null> {
    return this.getRoleByUserId(userId);
  }

  async listRoles(): Promise<Role[]> {
    return ROLE_DEFINITIONS;
  }

  async getRoleByUserId(userId: string): Promise<RoleName | null> {
    return getStore().rolesByUser[userId] ?? null;
  }

  async assignRole(userId: string, role: RoleName): Promise<void> {
    const store = getStore();
    store.rolesByUser[userId] = role;
    writeStore(store);
  }

  async countActiveByRole(role: RoleName): Promise<number> {
    return Object.values(getStore().rolesByUser).filter((storedRole) => storedRole === role).length;
  }
}

