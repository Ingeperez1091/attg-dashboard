import { Application } from "@/core/domain/entities/Application";
import { IApplicationRepository } from "@/core/domain/repositories/IApplicationRepository";
import { createStoreAccessor } from "@/infrastructure/persistence/memory/sharedStore";

const APPLICATION_CATALOG: Application[] = [
  { applicationId: "10000000-0000-0000-0000-000000000001", applicationName: "Maestro", description: "Engagement analytics", isActive: true },
  { applicationId: "10000000-0000-0000-0000-000000000002", applicationName: "EYST", description: "Client tax workflow", isActive: true },
  { applicationId: "10000000-0000-0000-0000-000000000003", applicationName: "Prodigy", description: "R&D reporting", isActive: true },
  { applicationId: "10000000-0000-0000-0000-000000000004", applicationName: "Vector", description: "Technology metrics", isActive: true },
  { applicationId: "10000000-0000-0000-0000-000000000005", applicationName: "Navigate", description: "Planning dashboard", isActive: true }
];

type ApplicationRepoStore = {
  assignedByUser: Record<string, string[]>;
};

const sharedStoreFile = process.env.TEST_APPLICATION_REPOSITORY_STORE_FILE;

const { getStore, writeStore } = createStoreAccessor<ApplicationRepoStore>({
  storeFilePath: sharedStoreFile,
  globalKey: "__dashboardApplicationRepoStore",
  createEmptyStore: () => ({ assignedByUser: {} })
});

export class ApplicationMemoryRepository implements IApplicationRepository {
  async listActive(): Promise<Application[]> {
    return APPLICATION_CATALOG.filter((app) => app.isActive);
  }

  async listByUserId(userId: string): Promise<string[]> {
    const assigned = getStore().assignedByUser[userId] ?? [];
    return [...assigned];
  }

  async assign(userId: string, applicationId: string): Promise<void> {
    const store = getStore();
    const existing = new Set(store.assignedByUser[userId] ?? []);
    existing.add(applicationId);
    store.assignedByUser[userId] = Array.from(existing);
    writeStore(store);
  }

  async assignAll(userId: string): Promise<void> {
    const store = getStore();
    const set = new Set(store.assignedByUser[userId] ?? []);

    for (const app of APPLICATION_CATALOG) {
      set.add(app.applicationId);
    }

    set.add("*");
    store.assignedByUser[userId] = Array.from(set);
    writeStore(store);
  }

  async unassign(userId: string, applicationId: string): Promise<boolean> {
    const store = getStore();
    const set = new Set(store.assignedByUser[userId] ?? []);
    if (set.size === 0) {
      return false;
    }

    const removed = set.delete(applicationId);
    store.assignedByUser[userId] = Array.from(set);
    writeStore(store);
    return removed;
  }
}

