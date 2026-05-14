import {
  DashboardRunContext,
  DashboardUsageSnapshotRow
} from "@/core/domain/entities/DashboardUsageView";
import { DashboardUsageRepository } from "@/core/domain/repositories/dashboardUsageRepository";
import { createStoreAccessor } from "@/infrastructure/persistence/memory/sharedStore";

type DashboardUsageRepoStore = {
  rows: DashboardUsageSnapshotRow[];
  runContext: DashboardRunContext;
};

const sharedStoreFile = process.env.TEST_DASHBOARD_USAGE_REPOSITORY_STORE_FILE;

const { getStore, writeStore } = createStoreAccessor<DashboardUsageRepoStore>({
  storeFilePath: sharedStoreFile,
  globalKey: "__dashboardUsageRepoStore",
  createEmptyStore: () => ({
    rows: [],
    runContext: {
      latestCompletedRunId: null,
      activeRun: null
    }
  })
});

function listLatestByApplication(rows: DashboardUsageSnapshotRow[]): DashboardUsageSnapshotRow[] {
  const latestByApp = new Map<string, DashboardUsageSnapshotRow>();

  for (const row of rows) {
    const current = latestByApp.get(row.applicationId);
    if (!current) {
      latestByApp.set(row.applicationId, row);
      continue;
    }

    const currentDate = new Date(current.calculationDate).getTime();
    const candidateDate = new Date(row.calculationDate).getTime();
    if (candidateDate > currentDate) {
      latestByApp.set(row.applicationId, row);
    }
  }

  return Array.from(latestByApp.values());
}

export class DashboardUsageMemoryRepository implements DashboardUsageRepository {
  async listUsageRows(input: { applicationIds: string[]; runId?: string }): Promise<DashboardUsageSnapshotRow[]> {
    const filtered = getStore().rows.filter((row) => input.applicationIds.includes(row.applicationId));

    const scoped = input.runId
      ? filtered.filter((row) => row.runId === input.runId)
      : listLatestByApplication(filtered);

    return scoped.sort((a, b) => {
      const left = `${a.subServiceLine ?? ""}:${a.applicationName}`.toLowerCase();
      const right = `${b.subServiceLine ?? ""}:${b.applicationName}`.toLowerCase();
      return left.localeCompare(right);
    });
  }

  async getRunContext(input: { applicationIds: string[] }): Promise<DashboardRunContext> {
    const context = getStore().runContext;

    if (!context.activeRun || input.applicationIds.includes(context.activeRun.applicationId)) {
      return context;
    }

    return {
      latestCompletedRunId: context.latestCompletedRunId,
      activeRun: null
    };
  }

  setRowsForTests(rows: DashboardUsageSnapshotRow[]): void {
    const store = getStore();
    store.rows = [...rows];
    writeStore(store);
  }

  setRunContextForTests(runContext: DashboardRunContext): void {
    const store = getStore();
    store.runContext = runContext;
    writeStore(store);
  }
}
