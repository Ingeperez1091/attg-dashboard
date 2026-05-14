import { User } from "@/core/domain/entities/User";
import { IUserRepository } from "@/core/domain/repositories/IUserRepository";
import { AppError } from "@/lib/api/error-handler";
import { createStoreAccessor } from "@/infrastructure/persistence/memory/sharedStore";

function nowIso(): string {
  return new Date().toISOString();
}

type UserRepoStore = {
  users: User[];
  nextId: number;
};

const sharedStoreFile = process.env.TEST_USER_REPOSITORY_STORE_FILE;

const { getStore, writeStore } = createStoreAccessor<UserRepoStore>({
  storeFilePath: sharedStoreFile,
  globalKey: "__dashboardUserRepoStore",
  createEmptyStore: () => ({ users: [], nextId: 1 })
});

export class UserMemoryRepository implements IUserRepository {
  async getById(userId: string): Promise<User | null> {
    return this.findById(userId);
  }

  async findById(userId: string): Promise<User | null> {
    return getStore().users.find((user) => user.userId === userId) ?? null;
  }

  async findByAzureAdObjectId(azureAdObjectId: string): Promise<User | null> {
    return getStore().users.find((user) => user.azureAdObjectId === azureAdObjectId) ?? null;
  }

  async list(includeInactive = false): Promise<User[]> {
    return getStore().users.filter((user) => includeInactive || user.isActive);
  }

  async create(input: {
    username: string;
    email: string;
    displayName?: string;
    azureAdObjectId?: string;
    isActive: boolean;
    actorUserId: string;
  }): Promise<User> {
    const store = getStore();
    const duplicate = store.users.find(
      (existing) => existing.username === input.username || existing.email === input.email
    );

    if (duplicate) {
      throw new AppError(409, "CONFLICT", "User already exists.");
    }

    const userId = `mem-user-${store.nextId}`;
    store.nextId += 1;
    const timestamp = nowIso();

    const user: User = {
      userId,
      username: input.username,
      email: input.email,
      displayName: input.displayName ?? null,
      azureAdObjectId: input.azureAdObjectId ?? null,
      role: "viewer",
      applicationIds: [],
      isActive: input.isActive,
      createDate: timestamp,
      createdBy: input.actorUserId,
      updateDate: timestamp,
      updatedBy: input.actorUserId
    };

    store.users.push(user);
    writeStore(store);
    return user;
  }

  async updateIsActive(userId: string, isActive: boolean, actorUserId: string): Promise<User | null> {
    const store = getStore();
    const current = store.users.find((user) => user.userId === userId);
    if (!current) {
      return null;
    }

    const updated: User = {
      ...current,
      isActive,
      updateDate: nowIso(),
      updatedBy: actorUserId
    };

    const index = store.users.findIndex((user) => user.userId === userId);
    if (index >= 0) {
      store.users[index] = updated;
    }
    writeStore(store);
    return updated;
  }

  async bindAzureAdObjectId(userId: string, azureAdObjectId: string, actorUserId: string): Promise<User | null> {
    const store = getStore();
    const index = store.users.findIndex((user) => user.userId === userId);

    if (index < 0) {
      return null;
    }

    const existing = store.users[index];
    if (existing.azureAdObjectId) {
      return existing;
    }

    const updated: User = {
      ...existing,
      azureAdObjectId,
      updateDate: nowIso(),
      updatedBy: actorUserId
    };

    store.users[index] = updated;
    writeStore(store);
    return updated;
  }
}

